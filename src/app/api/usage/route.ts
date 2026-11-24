import { handle, ok } from "@/lib/api";
import { getUsageSummary } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET() {
  try {
    return ok(getUsageSummary());
  } catch (error) {
    return handle(error);
  }
}
