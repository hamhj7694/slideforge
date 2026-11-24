import { designSlide } from "@/lib/ai";
import { body, handle, ok } from "@/lib/api";
import {
  getProjectWithSlides,
  getSlide,
  snapshotSlideVersion,
  updateSlide,
} from "@/lib/repo";
import { reviseSlideSchema } from "@/lib/schemas";
import type { StructuredContent } from "@/lib/types";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; slideId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id, slideId } = await params;
    const input = await body(request, reviseSlideSchema);
    const project = getProjectWithSlides(id);
    const slide = getSlide(id, slideId);
    if (!project || !slide) throw new Error("슬라이드를 찾을 수 없습니다.");

    const result = await designSlide(
      {
        project,
        slide,
        outlineItem: project.brief.outline[slide.order] ?? null,
        previousKinds: project.slides
          .filter((item) => item.order < slide.order)
          .map((item) => item.layout.kind),
        instruction: input.instruction,
        mode: input.scope === "design-only" ? "design-only" : "regenerate",
      },
      { projectId: id, operation: "slide.revise" },
    );

    snapshotSlideVersion(id, slideId, "부분 수정 이전");
    const updatedContent: StructuredContent =
      input.scope === "design-only"
        ? slide.content
        : { ...result.data.content, title: result.data.content.title || slide.title };
    const updated = updateSlide(id, slideId, {
      content: updatedContent,
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
