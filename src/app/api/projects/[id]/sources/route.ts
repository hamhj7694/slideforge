import { body, handle, ok } from "@/lib/api";
import { fetchUrlContent, isImageMime } from "@/lib/files";
import { addSource, getUploadById } from "@/lib/repo";
import { sourceCreateSchema } from "@/lib/schemas";
import { truncate } from "@/lib/utils";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = await body(request, sourceCreateSchema);
    const type = input.type ?? input.kind;
    if (!type) throw new Error("자료 유형(type 또는 kind)을 지정해 주세요.");
    let text = input.text ?? "";
    let storedName: string | undefined;
    let mime: string | undefined;
    let url = input.url;

    if (input.uploadId) {
      const upload = getUploadById(input.uploadId);
      if (!upload) throw new Error("업로드된 파일을 찾을 수 없습니다.");
      text = upload.extractedText;
      storedName = upload.storedName;
      mime = upload.mime;
      url = upload.url;
    } else if (input.url) {
      const fetched = await fetchUrlContent(input.url);
      text = fetched.text;
      if (!input.title) input.title = fetched.title;
    }

    const source = addSource(id, {
      type,
      title: input.title,
      url,
      text: text ? text.slice(0, 50000) : undefined,
      storedName,
      mime,
      metadata: {
        ...(input.metadata ?? {}),
        ...(isImageMime(mime ?? "") ? { image: true } : {}),
        extractedPreview: truncate(text, 400),
      },
    });
    return ok({ source }, 201);
  } catch (error) {
    return handle(error);
  }
}
