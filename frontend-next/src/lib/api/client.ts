import { env } from '@/lib/config/env';

/**
 * Single typed API client used by both Server Components (absolute URL via
 * BACKEND_ORIGIN) and Client Components (relative '/api', proxied in dev /
 * NEXT_PUBLIC_API_URL in prod). Mirrors the old shared/utils/api.js surface.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  /** Next fetch caching controls (Server Components only). */
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
};

function resolveBaseUrl(): string {
  const strip = (u: string) => u.replace(/\/$/, '');
  if (typeof window === 'undefined') {
    // Server: must be absolute.
    return `${strip(env.apiUrl || env.backendOrigin)}/api`;
  }
  // Browser: explicit base in prod, else relative (next.config rewrite proxies it).
  return env.apiUrl ? `${strip(env.apiUrl)}/api` : '/api';
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {}, cache, next } = options;

  const res = await fetch(`${resolveBaseUrl()}${endpoint}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache,
    next,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string, token?: string | null, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(url, { ...opts, token }),
  post: <T>(url: string, body?: unknown, token?: string | null) =>
    apiRequest<T>(url, { method: 'POST', body, token }),
  put: <T>(url: string, body?: unknown, token?: string | null) =>
    apiRequest<T>(url, { method: 'PUT', body, token }),
  patch: <T>(url: string, body?: unknown, token?: string | null) =>
    apiRequest<T>(url, { method: 'PATCH', body, token }),
  delete: <T>(url: string, token?: string | null) =>
    apiRequest<T>(url, { method: 'DELETE', token }),
};
