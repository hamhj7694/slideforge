import { body, handle, ok } from "@/lib/api";
import {
  deleteSlide,
  getProjectWithSlides,
  getSlide,
  snapshotProjectVersion,
  snapshotSlideVersion,
  updateSlide,
} from "@/lib/repo";
import { updateSlideSchema } from "@/lib/schemas";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; slideId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id, slideId } = await params;
    const slide = getSlide(id, slideId);
    if (!slide) return ok({ slide: null }, 404);
    return ok({ slide });
  } catch (error) {
    return handle(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, slideId } = await params;
    const input = await body(request, updateSlideSchema);
    const previous = getSlide(id, slideId);
    if (!previous) return ok({ error: "슬라이드를 찾을 수 없습니다." }, 404);
    if (input.content || input.layout || input.rawInput) {
      snapshotSlideVersion(id, slideId, "수정 이전");
    }
    const slide = updateSlide(id, slideId, {
      ...input,
      ...(input.content
        ? {
            content: {
              ...previous.content,
              ...input.content,
              title: input.content.title || previous.content.title,
            },
          }
        : {}),
    });
    return ok({ slide });
  } catch (error) {
    return handle(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, slideId } = await params;
    const slide = getSlide(id, slideId);
    if (!slide) return ok({ error: "슬라이드를 찾을 수 없습니다." }, 404);
    snapshotProjectVersion(id, `페이지 삭제 이전 — ${slide.title}`);
    deleteSlide(id, slideId);
    return ok({ project: getProjectWithSlides(id) });
  } catch (error) {
    return handle(error);
  }
}
