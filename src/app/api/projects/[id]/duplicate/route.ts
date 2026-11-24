import { ApiError, handle, ok } from "@/lib/api";
import { duplicateProject } from "@/lib/repo";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const project = duplicateProject(id);
    if (!project) throw new ApiError("프로젝트를 찾을 수 없습니다.", 404);
    return ok({ project }, 201);
  } catch (error) {
    return handle(error);
  }
}
