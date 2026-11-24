import fs from "node:fs/promises";
import path from "node:path";
import { handle } from "@/lib/api";
import { dataDir } from "@/lib/db";
import { getUploadByStoredName } from "@/lib/repo";

export const runtime = "nodejs";
type Params = { params: Promise<{ storedName: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { storedName } = await params;
    if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(storedName)) {
      return new Response("Invalid file", { status: 400 });
    }
    const record = getUploadByStoredName(storedName);
    const filePath = path.join(dataDir(), "uploads", storedName);
    const data = await fs.readFile(filePath);
    const ext = path.extname(storedName).toLowerCase();
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": record?.mime || MIME[ext] || "application/octet-stream",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return handle(error);
  }
}
