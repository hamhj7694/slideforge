import { body, handle, ok } from "@/lib/api";
import { resolveDesignSystem } from "@/lib/design";
import {
  createSlide,
  deleteSlide,
  getProjectWithSlides,
  snapshotProjectVersion,
  updateProject,
  updateSlide,
} from "@/lib/repo";
import { outlineSaveSchema } from "@/lib/schemas";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = await body(request, outlineSaveSchema);
    const current = getProjectWithSlides(id);
    if (!current) throw new Error("프로젝트를 찾을 수 없습니다.");
    if (!input.brief.outline.length) throw new Error("목차가 비어 있습니다.");

    snapshotProjectVersion(id, input.designPreset ? "목차·디자인 변경 이전" : "목차 변경 이전");

    const designPreset =
      input.designPreset && input.designPreset !== current.designSystem.preset
        ? resolveDesignSystem(current.designSystem, input.designPreset)
        : undefined;

    updateProject(id, {
      brief: input.brief,
      ...(designPreset ? { designSystem: designPreset } : {}),
    });

    const sorted = [...current.slides].sort((a, b) => a.order - b.order);
    input.brief.outline.forEach((item, index) => {
      const existing = sorted[index];
      if (existing) {
        updateSlide(id, existing.id, {
          title: item.title,
          role: item.role,
          partId: item.partId,
          content: { ...existing.content, title: item.title },
        });
      } else {
        createSlide(id, {
          title: item.title,
          role: item.role,
          partId: item.partId,
        });
      }
    });
    sorted.slice(input.brief.outline.length).forEach((slide) => deleteSlide(id, slide.id));

    if (designPreset) {
      const fresh = getProjectWithSlides(id)!;
      fresh.slides.forEach((slide) => updateSlide(id, slide.id, { designOverrides: {} }));
    }

    return ok({ project: getProjectWithSlides(id) });
  } catch (error) {
    return handle(error);
  }
}
