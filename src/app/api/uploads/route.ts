import { handle, ok } from "@/lib/api";
import { saveUpload } from "@/lib/files";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("파일이 전달되지 않았습니다.");
    const upload = await saveUpload(file);
    return ok({ upload }, 201);
  } catch (error) {
    return handle(error);
  }
}
