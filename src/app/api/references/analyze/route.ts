import { analyzeReference } from "@/lib/ai/reference-analysis";
import { body, handle, ok } from "@/lib/api";
import { fetchUrlContent } from "@/lib/files";
import { getUploadById } from "@/lib/repo";
import { referenceInputSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await body(request, referenceInputSchema);
    let text = input.text ?? "";
    let label = input.label;

    if (input.uploadId) {
      const upload = getUploadById(input.uploadId);
      if (!upload) throw new Error("업로드된 참고 파일을 찾을 수 없습니다.");
      text = upload.extractedText || "";
      label = label || upload.originalName;
    } else if (input.url) {
      const fetched = await fetchUrlContent(input.url);
      text = fetched.text;
      label = label || fetched.title;
    }

    const analysis = analyzeReference({
      role: input.role,
      label,
      sourceType: input.sourceType,
      text,
      note: input.note,
      paletteHints: input.paletteHints,
    });
    return ok({ analysis });
  } catch (error) {
    return handle(error);
  }
}
