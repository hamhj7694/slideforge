import { planProject, designSlide } from "@/lib/ai";
import { analyzeReference } from "@/lib/ai/reference-analysis";
import { DETECTED_PRESET_FALLBACK } from "@/lib/ai/design-bridge";
import { ApiError, body, handle, ok } from "@/lib/api";
import { resolveDesignSystem } from "@/lib/design";
import { fetchUrlContent, isImageMime } from "@/lib/files";
import {
  classifyReferenceRole,
  classifySource,
  inferReferencePalette,
  materialForSlide,
  parseIntake,
} from "@/lib/intake";
import {
  createProject,
  getProjectWithSlides,
  getUploadById,
  snapshotProjectVersion,
  updateSlide,
} from "@/lib/repo";
import { studioCreateSchema } from "@/lib/schemas";
import type { OutlineSource } from "@/lib/ai/local-outline";
import type {
  LayoutKind,
  ProjectSource,
  ReferenceAnalysis,
  SourceType,
} from "@/lib/types";
import { newId, truncate } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const input = await body(request, studioCreateSchema);
    const parsed = parseIntake(input.masterPrompt);
    const sources: ProjectSource[] = [];
    const outlineSources: OutlineSource[] = [];
    const references: ReferenceAnalysis[] = [];
    const notices: string[] = [];

    for (const item of input.sources ?? []) {
      let original = item.text ?? "";
      let mime = item.mime;
      let filePath: string | undefined;
      let title = item.label;

      if (item.uploadId) {
        const upload = getUploadById(item.uploadId);
        if (!upload) throw new ApiError("첨부 파일을 찾을 수 없습니다.", 404);
        original = upload.extractedText || "";
        filePath = upload.url;
        mime = upload.mime;
      } else if (item.url) {
        try {
          const fetched = await fetchUrlContent(item.url);
          original = fetched.text;
          title = title || fetched.title;
        } catch (error) {
          throw new ApiError(`URL 자료를 읽을 수 없습니다: ${(error as Error).message}`, 400);
        }
      }

      const type: SourceType = item.kind ?? classifySource(title, mime ?? "");
      if (!original.trim() && !isImageMime(mime ?? "")) {
        original = `[${title}] 원문 텍스트를 추출하지 못했습니다. 이 자료는 내용 근거로 쓰지 않았습니다.`;
      }

      const source: ProjectSource = {
        id: newId("src"),
        projectId: "",
        type,
        title,
        url: item.url,
        filePath,
        originalContent: original.slice(0, 50000),
        extractedContent: truncate(original, 15000),
        extractionStatus: original || mime ? "done" : "failed",
        metadata: {
          ...(isImageMime(mime ?? "") ? { image: true } : {}),
          ...(item.note ? { note: item.note } : {}),
        },
        importedAt: new Date().toISOString(),
      };
      sources.push(source);

      if (item.isReference) {
        const analysis = analyzeReference({
          role: classifyReferenceRole(title, item.note),
          label: title,
          sourceType: type,
          text: original,
          note: item.note,
          paletteHints: inferReferencePalette(title),
        });
        references.push(analysis);
        source.metadata = {
          ...source.metadata,
          role: "reference",
          referenceRole: analysis.role,
          analysis,
        };
      } else {
        outlineSources.push({ label: source.title, content: source.extractedContent });
      }
    }

    const plan = await planProject(
      {
        title: input.title ?? parsed.title,
        masterPrompt: input.masterPrompt,
        purpose: parsed.purpose,
        audience: parsed.audience,
        tone: parsed.tone,
        pageCount: input.pageCount ?? parsed.pageCount,
        preset: input.preset,
        sources: outlineSources,
        references,
      },
      {
        operation: "studio.create.plan",
        forceProvider: input.forceProvider,
        forceModel: input.forceModel,
      },
    );
    if (plan.notice) notices.push(plan.notice);

    const refPreset = references.find((reference) => reference.presetHint)?.presetHint;
    const preset = DETECTED_PRESET_FALLBACK(
      input.preset ?? plan.data.preset ?? refPreset ?? parsed.tone ?? "",
    );
    const brief = plan.data.brief;
    const project = createProject({
      title: input.title?.trim() || parsed.title || brief.outline[0]?.title || "새 포트폴리오",
      masterPrompt: input.masterPrompt,
      purpose: parsed.purpose || brief.purpose,
      audience: parsed.audience || brief.audience,
      tone: parsed.tone || brief.tone,
      brief,
      designSystem: resolveDesignSystem(undefined, preset),
      sources,
    });

    // createProject already seeds one slide per outline item; fill those, don't add more.
    const seeded = [...project.slides].sort((a, b) => a.order - b.order);
    const generated: string[] = [];
    const previousKinds: LayoutKind[] = [];
    for (const slide of seeded) {
      const outline = brief.outline[slide.order] ?? null;
      const rawInput = materialForSlide(
        input.masterPrompt,
        outline?.title ?? slide.title,
        outline?.role ?? slide.role,
        outline?.keyMessage ?? "",
      );
      updateSlide(project.id, slide.id, { rawInput });
      const result = await designSlide(
        {
          project,
          slide: { ...slide, rawInput },
          outlineItem: outline,
          previousKinds,
          instruction: "",
          mode: "generate",
        },
        { projectId: project.id, operation: "studio.create.slide" },
      );
      if (result.notice && !notices.includes(result.notice)) notices.push(result.notice);
      updateSlide(project.id, slide.id, {
        title: result.data.content.title || slide.title,
        content: result.data.content,
        layout: result.data.layout,
        status: "generated",
      });
      previousKinds.push(result.data.layout.kind);
      generated.push(slide.id);
    }

    const versionId = snapshotProjectVersion(project.id, "처음 생성한 상태");

    return ok(
      {
        project: getProjectWithSlides(project.id),
        versionId,
        generation: {
          provider: plan.provider,
          model: plan.model,
          notice: notices[0],
          notices,
          references: references.length,
          slides: generated.length,
        },
      },
      201,
    );
  } catch (error) {
    return handle(error);
  }
}
