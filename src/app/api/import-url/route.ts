import { body, handle, ok } from "@/lib/api";
import { fetchUrlContent } from "@/lib/files";
import { importUrlSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await body(request, importUrlSchema);
    const result = await fetchUrlContent(input.url);
    return ok(result);
  } catch (error) {
    return handle(error);
  }
}
