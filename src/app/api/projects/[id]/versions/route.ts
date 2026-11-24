import { z } from "zod";
import { body, handle, ok } from "@/lib/api";
import { listVersions, snapshotProjectVersion } from "@/lib/repo";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const createVersionSchema = z.object({
  label: z.string().max(160).optional(),
  slideId: z.string().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return ok({ versions: listVersions(id) });
  } catch (error) {
    return handle(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = await body(request, createVersionSchema);
    const versionId = snapshotProjectVersion(
      id,
      input.label ?? "새 버전",
      input.slideId ? "slide" : "project",
      input.slideId,
    );
    return ok({ versionId, versions: listVersions(id, input.slideId) }, 201);
  } catch (error) {
    return handle(error);
  }
}
