import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, detail?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, ...(detail ? { detail } : {}) },
    { status },
  );
}

export async function body<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("잘못된 JSON 요청입니다.", 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error instanceof ZodError ? result.error.issues : [];
    throw new ApiError(
      issues[0]?.message ?? "요청 값이 올바르지 않습니다.",
      400,
      issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return result.data;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public detail?: unknown,
  ) {
    super(message);
  }
}

export function handle(error: unknown) {
  if (error instanceof ApiError) return fail(error.message, error.status, error.detail);
  if (error instanceof ZodError) {
    return fail(error.issues[0]?.message ?? "검증 오류", 400, error.issues);
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("[slideforge]", message);
  return fail(message || "서버 오류가 발생했습니다.", 500);
}
