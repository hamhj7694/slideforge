export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  detail?: unknown;
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body && !(options.body instanceof FormData)
        ? { "content-type": "application/json" }
        : {}),
      ...(options?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.ok || !response.ok) {
    throw new Error(payload.error || `요청 실패 (${response.status})`);
  }
  return payload.data as T;
}

export function apiPost<T>(url: string, body: unknown) {
  return api<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(url: string, body: unknown) {
  return api<T>(url, { method: "PATCH", body: JSON.stringify(body) });
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
