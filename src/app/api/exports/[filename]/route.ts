import fs from "node:fs/promises";
import path from "node:path";
import { handle } from "@/lib/api";
import { dataDir } from "@/lib/db";

export const runtime = "nodejs";
type Params = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { filename } = await params;
    if (!/^slideforge-[a-zA-Z0-9_-]+-\d+\.(pdf|pptx)$/.test(filename)) {
      return new Response("Invalid file", { status: 400 });
    }
    const bytes = await fs.readFile(path.join(dataDir(), "exports", filename));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": filename.endsWith(".pdf")
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return handle(error);
  }
}
