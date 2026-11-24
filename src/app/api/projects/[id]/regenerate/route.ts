import { designSlide } from "@/lib/ai";
import { body, handle, ok } from "@/lib/api";
import {
  getProjectWithSlides,
  snapshotProjectVersion,
  updateSlide,
} from "@/lib/repo";
import { bulkRegenerateSchema } from "@/lib/schemas";
import type { LayoutKind } from "@/lib/types";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = await body(request, bulkRegenerateSchema);
    const before = getProjectWithSlides(id);
    if (!before) throw new Error("프로젝트를 찾을 수 없습니다.");

    const targets = before.slides.filter((slide) => {
      if (input.slideIds?.length && !input.slideIds.includes(slide.id)) return false;
      if (input.respectLocked && slide.locked) return false;
      return true;
    });

    const versionId = snapshotProjectVersion(id, "전체 재생성 이전");
    const notices: string[] = [];
    let changed = 0;

    for (const slide of targets) {
      const project = getProjectWithSlides(id)!;
      const fresh = project.slides.find((item) => item.id === slide.id) ?? slide;
      const previousKinds = project.slides
        .filter((item) => item.order < fresh.order)
        .map((item) => item.layout.kind as LayoutKind);
      const result = await designSlide(
        {
          project,
          slide: fresh,
          outlineItem: project.brief.outline[fresh.order] ?? null,
          previousKinds,
          instruction: input.instruction,
          mode: input.mode === "design" ? "design-only" : "regenerate",
        },
        { projectId: id, operation: `bulk.${input.mode}` },
      );
      if (result.notice) notices.push(result.notice);
      updateSlide(id, fresh.id, {
        ...(input.mode === "design" ? {} : { content: result.data.content }),
        layout: result.data.layout,
        status: "generated",
      });
      changed += 1;
    }

    return ok({
      versionId,
      changed,
      skipped: before.slides.length - changed,
      project: getProjectWithSlides(id),
      notice:
        notices[0] ??
        `${changed}개 페이지를 재생성했습니다. 이전 상태는 버전 ${versionId}에서 복원할 수 있습니다.`,
    });
  } catch (error) {
    return handle(error);
  }
}
