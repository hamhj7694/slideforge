import { handle, ok } from "@/lib/api";
import {
  getProjectWithSlides,
  restoreProjectVersion,
  restoreSlideVersion,
} from "@/lib/repo";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; versionId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id, versionId } = await params;
    const url = new URL(request.url);
    const slideId = url.searchParams.get("slideId");
    if (slideId) {
      const slide = restoreSlideVersion(id, slideId, versionId);
      if (!slide) throw new Error("복원할 버전을 찾을 수 없습니다.");
      return ok({ slide, project: getProjectWithSlides(id) });
    }
    const project = restoreProjectVersion(id, versionId);
    if (!project) throw new Error("복원할 버전을 찾을 수 없습니다.");
    return ok({ project });
  } catch (error) {
    return handle(error);
  }
}
