import { z } from "zod";
import { getApiKey, getSettings, recordUsage, type ResolvedSettings } from "../repo";
import { contentSchema, layoutSchema } from "../schemas";
import type {
  DesignSystem,
  LayoutSpec,
  OutlineItem,
  ProjectBrief,
  StructuredContent,
} from "../types";
import { DETECTED_PRESET_FALLBACK } from "./design-bridge";
import { buildLocalOutline, describeArc, type OutlineInput } from "./local-outline";
import { buildLocalSlide, type LocalSlideInput, type LocalSlideResult } from "./local-slide";
import { DESIGN_SYSTEM, OUTLINE_SYSTEM, SLIDE_SYSTEM } from "./prompts";

export interface AiResult<T> {
  data: T;
  provider: string;
  model: string;
  notice?: string;
  usage: { input: number; output: number; cost: number };
}

interface CallResult {
  text: string;
  input: number;
  output: number;
}

interface CallOptions {
  provider: ResolvedSettings["provider"];
  model: string;
  system: string;
  user: string;
  apiKey: string;
  baseUrl: string;
}

function estimateCost(provider: string, model: string, input: number, output: number) {
  if (provider === "local" || !provider) return 0;
  const rates: Record<string, [number, number]> = {
    "gpt-4o-mini": [0.00015, 0.0006],
    "gpt-4.1-mini": [0.0004, 0.0016],
    "gpt-4o": [0.0025, 0.01],
    "claude-3-5-haiku-latest": [0.00025, 0.00125],
    "claude-sonnet-4-5": [0.003, 0.015],
    "claude-3-5-sonnet-latest": [0.003, 0.015],
  };
  const [inRate, outRate] = rates[model] ?? [0.0005, 0.002];
  return (input / 1000) * inRate + (output / 1000) * outRate;
}

function endpointFor(options: CallOptions) {
  if (options.provider === "anthropic") return "https://api.anthropic.com/v1/messages";
  if (options.provider === "openrouter") return `${options.baseUrl || "https://openrouter.ai/api/v1"}/chat/completions`;
  return `${options.baseUrl || "https://api.openai.com/v1"}/chat/completions`;
}

async function callModel(options: CallOptions): Promise<CallResult> {
  const response = await fetch(endpointFor(options), {
    method: "POST",
    headers:
      options.provider === "anthropic"
        ? {
            "content-type": "application/json",
            "x-api-key": options.apiKey,
            "anthropic-version": "2023-06-01",
          }
        : {
            "content-type": "application/json",
            authorization: `Bearer ${options.apiKey}`,
          },
    body:
      options.provider === "anthropic"
        ? JSON.stringify({
            model: options.model,
            max_tokens: 4000,
            system: options.system,
            messages: [{ role: "user", content: options.user }],
          })
        : JSON.stringify({
            model: options.model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: options.system },
              { role: "user", content: options.user },
            ],
          }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`AI provider responded ${response.status}: ${detail}`);
  }
  const json = (await response.json()) as Record<string, unknown>;
  const text =
    options.provider === "anthropic"
      ? ((json.content as { text?: string }[] | undefined)?.[0]?.text ?? "")
      : (((json.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content) ?? "");
  if (!text) throw new Error("AI provider returned an empty response.");
  const usage = (json.usage ?? {}) as Record<string, number>;
  return {
    text,
    input: usage.prompt_tokens ?? usage.input_tokens ?? 0,
    output: usage.completion_tokens ?? usage.output_tokens ?? 0,
  };
}

function jsonFrom(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI response is not JSON.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

interface AiContext {
  projectId?: string;
  forceProvider?: ResolvedSettings["provider"];
  forceModel?: string;
  operation: string;
}

function resolveConfig(context: AiContext): {
  provider: ResolvedSettings["provider"];
  model: string;
  apiKey: string;
  baseUrl: string;
  requested: ResolvedSettings["provider"];
  notice?: string;
} {
  const saved = getSettings();
  const provider = context.forceProvider ?? saved.provider;
  const model = context.forceModel || (provider === saved.provider ? saved.model : "");
  const fallbackModel =
    provider === "openai"
      ? "gpt-4o-mini"
      : provider === "anthropic"
        ? "claude-3-5-haiku-latest"
        : provider === "openrouter"
          ? "openai/gpt-4o-mini"
          : "local-draft-v1";
  const apiKey = getApiKey(provider);
  const active: ResolvedSettings["provider"] =
    provider !== "local" && Boolean(apiKey) ? provider : "local";
  return {
    provider: active,
    model: active === "local" ? "local-draft-v1" : model || fallbackModel,
    apiKey,
    baseUrl: saved.baseUrl,
    requested: provider,
    notice:
      provider !== "local" && !apiKey
        ? `선택한 ${provider} API 키가 없어 로컬 생성 엔진으로 처리했습니다. 설정에서 키를 입력하면 실제 모델을 사용합니다.`
        : undefined,
  };
}

function logUsage(context: AiContext, result: AiResult<unknown>) {
  if (!context.projectId) return;
  recordUsage({
    projectId: context.projectId,
    operation: context.operation,
    provider: result.provider,
    model: result.model,
    inputTokens: result.usage.input,
    outputTokens: result.usage.output,
    costUsd: result.usage.cost,
  });
}

const outlineItemSchema = z.object({
  id: z.string(),
  partId: z.string().optional(),
  title: z.string(),
  role: z.string(),
  keyMessage: z.string(),
  visual: z.enum([
    "cover", "section", "statement", "split", "editorial-3col", "metrics",
    "timeline", "process", "before-after", "case-study", "fullbleed",
    "gallery", "table", "data-story", "closing",
  ]),
});

const briefResultSchema = z.object({
  purpose: z.string(),
  audience: z.string(),
  coreMessage: z.string(),
  storyline: z.string(),
  tone: z.string(),
  visualDirection: z.string(),
  differentiators: z.array(z.string()),
  parts: z.array(z.object({ id: z.string(), title: z.string(), description: z.string() })),
  preset: z.string().optional(),
  outline: z.array(outlineItemSchema).min(3).max(30),
});

export async function planProject(
  input: OutlineInput,
  context: AiContext,
): Promise<AiResult<{ brief: ProjectBrief; preset: string }>> {
  const local = buildLocalOutline(input);
  const refPresetHint = input.references?.find((reference) => reference.presetHint)?.presetHint;
  const localPreset = DETECTED_PRESET_FALLBACK(
    input.preset ?? refPresetHint ?? input.tone ?? input.masterPrompt,
  );
  const fallback: AiResult<{ brief: ProjectBrief; preset: string }> = {
    data: { brief: local, preset: localPreset },
    provider: "local",
    model: "local-draft-v1",
    usage: { input: 0, output: 0, cost: 0 },
  };
  const config = resolveConfig(context);
  if (config.provider === "local") return { ...fallback, notice: config.notice };

  try {
    const sourceText = (input.sources ?? [])
      .map((source) => `[${source.label}]\n${source.content.slice(0, 12000)}`)
      .join("\n\n");
    const call = await callModel({
      ...config,
      system: OUTLINE_SYSTEM,
      user: [
        `메인 프롬프트:\n${input.masterPrompt}`,
        input.title ? `요청 제목: ${input.title}` : "",
        input.purpose ? `목적: ${input.purpose}` : "",
        input.audience ? `독자: ${input.audience}` : "",
        input.tone ? `톤: ${input.tone}` : "",
        `요청 페이지 수: ${input.pageCount ?? "자유"}`,
        `선호 디자인: ${input.preset ?? refPresetHint ?? "자유"}`,
        `참고 레퍼런스 분석(JSON):\n${JSON.stringify(input.references ?? [])}`,
        `참고 자료:\n${sourceText || "(없음)"}`,
      ].filter(Boolean).join("\n\n"),
    });
    const parsed = briefResultSchema.parse(jsonFrom(call.text));
    const data = {
      brief: {
        ...parsed,
        outline: parsed.outline.map((item, index) => ({
          ...item,
          id: item.id || `ol-${index + 1}`,
        })),
      } as ProjectBrief,
      preset: DETECTED_PRESET_FALLBACK(parsed.preset ?? input.preset ?? refPresetHint ?? ""),
    };
    const result: AiResult<typeof data> = {
      data,
      provider: config.provider,
      model: config.model,
      usage: {
        input: call.input,
        output: call.output,
        cost: estimateCost(config.provider, config.model, call.input, call.output),
      },
    };
    logUsage(context, result);
    return result;
  } catch (error) {
    const result: AiResult<{ brief: ProjectBrief; preset: string }> = {
      ...fallback,
      notice: `AI 생성에 실패해 로컬 초안을 사용했습니다: ${(error as Error).message.slice(0, 120)}`,
    };
    logUsage(context, result);
    return result;
  }
}

export async function designSlide(
  input: LocalSlideInput,
  context: AiContext,
): Promise<AiResult<LocalSlideResult>> {
  const fallback: AiResult<LocalSlideResult> = {
    data: buildLocalSlide(input),
    provider: "local",
    model: "local-draft-v1",
    usage: { input: 0, output: 0, cost: 0 },
  };
  const config = resolveConfig(context);
  if (config.provider === "local") return { ...fallback, notice: config.notice };

  try {
    const call = await callModel({
      ...config,
      system: SLIDE_SYSTEM,
      user: [
        `프로젝트 제목: ${input.project.title}`,
        `목적: ${input.project.purpose}`,
        `독자: ${input.project.audience}`,
        `핵심 메시지: ${input.project.brief.coreMessage}`,
        `전체 줄거리:\n${input.project.brief.storyline}`,
        `이전 페이지 레이아웃: ${(input.previousKinds ?? []).join(", ") || "없음"}`,
        `현재 페이지 제목: ${input.slide.title}`,
        `페이지 역할: ${input.slide.role}`,
        `원본 입력:\n${input.slide.rawInput || "(비어 있음)"}`,
        `첨부 이미지: ${(input.slide.attachments ?? []).map((a) => a.url).join(", ") || "없음"}`,
        `사용자 요청: ${input.instruction || "없음"}`,
      ].join("\n\n"),
    });
    const parsed = jsonFrom(call.text);
    const content = contentSchema.parse(parsed.content ?? {}) as StructuredContent;
    const layout = layoutSchema.parse(parsed.layout ?? { kind: "statement" }) as LayoutSpec;
    const result: AiResult<LocalSlideResult> = {
      data: { content, layout },
      provider: config.provider,
      model: config.model,
      usage: {
        input: call.input,
        output: call.output,
        cost: estimateCost(config.provider, config.model, call.input, call.output),
      },
    };
    logUsage(context, result);
    return result;
  } catch (error) {
    const result: AiResult<LocalSlideResult> = {
      ...fallback,
      notice: `AI 생성에 실패해 로컬 결과를 유지했습니다: ${(error as Error).message.slice(0, 120)}`,
    };
    logUsage(context, result);
    return result;
  }
}

export async function proposeDesignSystem(
  input: {
    brief: ProjectBrief;
    preset?: string;
    instruction?: string;
    current?: DesignSystem;
  },
  context: AiContext,
): Promise<AiResult<Partial<DesignSystem>>> {
  const config = resolveConfig(context);
  const fallback: AiResult<Partial<DesignSystem>> = {
    data: {},
    provider: "local",
    model: "local-draft-v1",
    usage: { input: 0, output: 0, cost: 0 },
  };
  if (config.provider === "local") return { ...fallback, notice: config.notice };
  try {
    const call = await callModel({
      ...config,
      system: DESIGN_SYSTEM,
      user: [
        `프로젝트 톤: ${input.brief.tone}`,
        `시각 방향: ${input.brief.visualDirection}`,
        `선호 프리셋: ${input.preset ?? "자유"}`,
        `사용자 요청: ${input.instruction ?? "없음"}`,
        `현재 팔레트: ${JSON.stringify(input.current?.palette ?? {})}`,
      ].join("\n\n"),
    });
    const parsed = jsonFrom(call.text);
    const result: AiResult<Partial<DesignSystem>> = {
      data: parsed as Partial<DesignSystem>,
      provider: config.provider,
      model: config.model,
      usage: {
        input: call.input,
        output: call.output,
        cost: estimateCost(config.provider, config.model, call.input, call.output),
      },
    };
    logUsage(context, result);
    return result;
  } catch (error) {
    const result = {
      ...fallback,
      notice: `디자인 AI 호출 실패: ${(error as Error).message.slice(0, 120)}`,
    };
    logUsage(context, result);
    return result;
  }
}

export function contextForOutline(input: {
  outline: OutlineItem[];
  brief: ProjectBrief;
}) {
  return describeArc(input.outline);
}
