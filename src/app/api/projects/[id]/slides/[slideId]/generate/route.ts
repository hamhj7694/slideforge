import { designSlide } from "@/lib/ai";
import { body, handle, ok } from "@/lib/api";
import {
  getProjectWithSlides,
  getSlide,
  snapshotSlideVersion,
  updateSlide,
} from "@/lib/repo";
import { generateSlideSchema } from "@/lib/schemas";
import type { LayoutKind, StructuredContent } from "@/lib/types";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; slideId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id, slideId } = await params;
    const input = await body(request, generateSlideSchema);
    const project = getProjectWithSlides(id);
    const slide = getSlide(id, slideId);
    if (!project || !slide) throw new Error("프로젝트 또는 슬라이드를 찾을 수 없습니다.");

    const sorted = [...project.slides].sort((a, b) => a.order - b.order);
    const previousKinds = sorted
      .filter((item) => item.order < slide.order)
      .map((item) => item.layout.kind as LayoutKind);
    const outlineItem = project.brief.outline[slide.order] ?? null;
    const result = await designSlide(
      {
        project,
        slide,
        outlineItem,
        previousKinds,
        instruction: input.instruction,
        mode: input.mode,
      },
      { projectId: id, operation: `slide.${input.mode}` },
    );

    snapshotSlideVersion(id, slideId, "AI 생성 이전");
    const content: StructuredContent =
      input.mode === "design-only"
        ? slide.content
        : {
            ...result.data.content,
            title: result.data.content.title || slide.title,
          };
    const updated = updateSlide(id, slideId, {
      content,
      layout: result.data.layout,
      status: "generated",
    });

    return ok({
      slide: updated,
      generation: {
        provider: result.provider,
        model: result.model,
        notice: result.notice,
        usage: result.usage,
      },
    });
  } catch (error) {
    return handle(error);
  }
}
