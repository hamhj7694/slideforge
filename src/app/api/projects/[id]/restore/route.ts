import { handle, ok } from "@/lib/api";
import { getProject, restoreProject } from "@/lib/repo";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    restoreProject(id);
    return ok({ project: getProject(id, true) });
  } catch (error) {
    return handle(error);
  }
}
