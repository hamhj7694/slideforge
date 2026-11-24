import { body, handle, ok } from "@/lib/api";
import {
  getProjectWithSlides,
  softDeleteProject,
  updateProject,
} from "@/lib/repo";
import { updateProjectSchema } from "@/lib/schemas";
import { snapshotProjectVersion } from "@/lib/repo";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const project = getProjectWithSlides(id);
    if (!project) return ok({ project: null }, 404);
    return ok({ project });
  } catch (error) {
    return handle(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = await body(request, updateProjectSchema);
    if (input.designSystem || input.brief) {
      snapshotProjectVersion(id, input.designSystem ? "디자인 변경 이전" : "구성 변경 이전");
    }
    const project = updateProject(id, input);
    if (!project) return ok({ error: "프로젝트를 찾을 수 없습니다." }, 404);
    return ok({ project: getProjectWithSlides(id) });
  } catch (error) {
    return handle(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const project = getProjectWithSlides(id);
    if (!project) return ok({ error: "프로젝트를 찾을 수 없습니다." }, 404);
    snapshotProjectVersion(id, "삭제 이전 스냅샷");
    softDeleteProject(id);
    return ok({ id, deleted: true });
  } catch (error) {
    return handle(error);
  }
}
