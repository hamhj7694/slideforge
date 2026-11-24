import { handle, ok } from "@/lib/api";
import { deleteSource } from "@/lib/repo";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; sourceId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, sourceId } = await params;
    deleteSource(id, sourceId);
    return ok({ id: sourceId, deleted: true });
  } catch (error) {
    return handle(error);
  }
}
