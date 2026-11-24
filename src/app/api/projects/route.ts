import { planProject } from "@/lib/ai";
import { DETECTED_PRESET_FALLBACK } from "@/lib/ai/design-bridge";
import { ApiError, body, fail, handle, ok } from "@/lib/api";
import { resolveDesignSystem } from "@/lib/design";
import { fetchUrlContent, isImageMime } from "@/lib/files";
import {
  createProject,
  getUploadById,
  listProjects,
  recordUsage,
} from "@/lib/repo";
import { createProjectSchema } from "@/lib/schemas";
import type { OutlineSource } from "@/lib/ai/local-outline";
import type { ProjectSource, ReferenceAnalysis } from "@/lib/types";
import { newId, truncate } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projects = listProjects({
      search: url.searchParams.get("search") ?? undefined,
      includeDeleted: url.searchParams.get("includeDeleted") === "1",
    });
    return ok({ projects });
  } catch (error) {
    return handle(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await body(request, createProjectSchema);
    const sources: ProjectSource[] = [];
    const outlineSources: OutlineSource[] = [];

    for (const item of input.sources ?? []) {
      let original = item.text ?? "";
      let sourceUrl = item.url;
      let filePath: string | undefined;
      let mime = item.mime;
      let title = item.label;

      if (item.uploadId) {
        const upload = getUploadById(item.uploadId);
        if (!upload) throw new ApiError("첨부 파일을 찾을 수 없습니다.", 404);
        original = upload.extractedText || "";
        filePath = upload.url;
        mime = upload.mime;
        if (!title || title === upload.originalName) title = upload.originalName;
      } else if (item.url) {
        try {
          const fetched = await fetchUrlContent(item.url);
          original = fetched.text;
          title = title || fetched.title;
        } catch (error) {
          throw new ApiError(
            `URL 자료를 읽을 수 없습니다: ${(error as Error).message}`,
            400,
          );
        }
      }

      if (!original.trim() && !isImageMime(mime ?? "")) {
        original = `[${title}] 원문 텍스트를 추출하지 못했습니다. 사용자가 직접 내용을 입력해 주세요.`;
      }

      const source: ProjectSource = {
        id: newId("src"),
        projectId: "",
        type: item.kind,
        title: title || "제목 없는 자료",
        url: sourceUrl,
        filePath,
        originalContent: original.slice(0, 50000),
        extractedContent: truncate(original, 15000),
        extractionStatus: original ? "done" : "failed",
        metadata: {
          ...(item.metadata ?? {}),
          ...(isImageMime(mime ?? "") ? { image: true } : {}),
        },
        importedAt: new Date().toISOString(),
      };
      sources.push(source);
      outlineSources.push({ label: source.title, content: source.extractedContent });
    }

    const referenceAnalyses: ReferenceAnalysis[] = [];
    for (const reference of input.references ?? []) {
      let original = reference.text ?? "";
      let filePath: string | undefined;
      let mime: string | undefined;

      if (reference.uploadId) {
        const upload = getUploadById(reference.uploadId);
        if (!upload) throw new ApiError("참고 파일을 찾을 수 없습니다.", 404);
        original = upload.extractedText || "";
        filePath = upload.url;
        mime = upload.mime;
      } else if (reference.url && !original) {
        try {
          const fetched = await fetchUrlContent(reference.url);
          original = fetched.text;
        } catch (error) {
          throw new ApiError(
            `참고 URL을 읽을 수 없습니다: ${(error as Error).message}`,
            400,
          );
        }
      }

      sources.push({
        id: newId("src"),
        projectId: "",
        type: reference.sourceType,
        title: reference.label,
        url: reference.url,
        filePath,
        originalContent: original.slice(0, 50000),
        extractedContent: truncate(original, 15000),
        extractionStatus: original || mime ? "done" : "failed",
        metadata: {
          role: "reference",
          referenceRole: reference.role,
          analysis: reference.analysis,
          paletteHints: reference.paletteHints,
        },
        importedAt: new Date().toISOString(),
      });
      referenceAnalyses.push(reference.analysis);
    }

    const plan = await planProject(
      {
        title: input.title,
        masterPrompt: input.masterPrompt,
        purpose: input.purpose,
        audience: input.audience,
        tone: input.tone,
        pageCount: input.pageCount,
        preset: input.preset,
        sources: outlineSources,
        references: referenceAnalyses,
      },
      {
        operation: "project.plan",
        forceProvider: input.forceProvider,
        forceModel: input.forceModel,
      },
    );

    const preset = DETECTED_PRESET_FALLBACK(
      input.preset ?? plan.data.preset ?? input.tone ?? "",
    );
    const design = resolveDesignSystem(undefined, preset);
    const brief = plan.data.brief;
    const project = createProject({
      title: input.title?.trim() || brief.outline[0]?.title || "새 포트폴리오",
      masterPrompt: input.masterPrompt,
      purpose: input.purpose || brief.purpose,
      audience: input.audience || brief.audience,
      tone: input.tone || brief.tone,
      brief,
      designSystem: design,
      sources,
    });

    if (plan.notice) {
      recordUsage({
        projectId: project.id,
        operation: "project.plan.notice",
        provider: "local",
        model: "local-draft-v1",
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      });
    }

    return ok({
      project,
      generation: {
        provider: plan.provider,
        model: plan.model,
        notice: plan.notice,
        usage: plan.usage,
      },
    }, 201);
  } catch (error) {
    return handle(error);
  }
}
