export interface ApiSuccess<T = Record<string, unknown>> {
  ok: true;
  status: number;
  data: T;
  meta: Record<string, unknown>;
  headers: Headers;
}

export interface ApiFailure {
  ok: false;
  status: number;
  error: { code: string; message: string; details: Record<string, unknown> };
  meta: Record<string, unknown>;
  headers: Headers;
}

export type ApiResponse<T = Record<string, unknown>> = ApiSuccess<T> | ApiFailure;

export async function api<T = Record<string, unknown>>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const json = (await res.json()) as Record<string, unknown>;
  const resHeaders = res.headers;

  if ('error' in json && json.error && typeof json.error === 'object') {
    const err = json.error as { code: string; message: string; details?: Record<string, unknown> };
    return {
      ok: false,
      status: res.status,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      },
      meta: (json.meta as Record<string, unknown>) ?? {},
      headers: resHeaders,
    };
  }

  return {
    ok: true,
    status: res.status,
    data: json.data as T,
    meta: (json.meta as Record<string, unknown>) ?? {},
    headers: resHeaders,
  };
}

export function ref(label: string): string {
  return `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
