import fs from "node:fs/promises";
import path from "node:path";
import { handle, ok } from "@/lib/api";
import { dataDir } from "@/lib/db";
import { exportPdf, exportPptx } from "@/lib/exporters";

export const runtime = "nodejs";
export const maxDuration = 180;
type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "pptx" ? "pptx" : "pdf";
    const result = format === "pptx" ? await exportPptx(id) : await exportPdf(id);
    if (url.searchParams.get("download") === "1") {
      const bytes = await fs.readFile(path.join(dataDir(), "exports", result.filename));
      const contentType =
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": contentType,
          "content-disposition": `attachment; filename="${result.filename}"`,
        },
      });
    }
    return ok({ export: result });
  } catch (error) {
    return handle(error);
  }
}
