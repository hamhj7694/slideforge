import { body, handle, ok } from "@/lib/api";
import { createSlide } from "@/lib/repo";
import { createSlideSchema } from "@/lib/schemas";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = await body(request, createSlideSchema);
    const slide = createSlide(id, input);
    return ok({ slide }, 201);
  } catch (error) {
    return handle(error);
  }
}
