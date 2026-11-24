import { body, handle, ok } from "@/lib/api";
import { getProjectWithSlides, reorderSlides, snapshotProjectVersion } from "@/lib/repo";
import { reorderSchema } from "@/lib/schemas";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = await body(request, reorderSchema);
    snapshotProjectVersion(id, "페이지 순서 변경 이전");
    reorderSlides(id, input.slideIds);
    return ok({ project: getProjectWithSlides(id) });
  } catch (error) {
    return handle(error);
  }
}
