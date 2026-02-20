/**
 * API Client — single fetch wrapper for all backend calls.
 *
 * Features:
 *  - Base URL from NEXT_PUBLIC_API_BASE_URL
 *  - credentials: "include" (sends refresh_token cookie)
 *  - Attaches Authorization: Bearer <accessToken> if present
 *  - Auto-refresh on 401: calls POST /auth/refresh, retries once
 *  - Normalised error shape: { code, message, requestId, details, status }
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

// ── Token storage (in-memory only, never localStorage) ──
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// ── Normalised API error ──
export interface ApiError {
  code: string;
  message: string;
  requestId: string | null;
  details: unknown;
  status: number;
}

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'code' in e && 'status' in e;
}

// ── Refresh lock (prevent concurrent refresh calls) ──
let _refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Deduplicate concurrent 401 retries
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ── Logout callback (set by auth store) ──
let _onForceLogout: (() => void) | null = null;

export function setForceLogoutCallback(cb: () => void) {
  _onForceLogout = cb;
}

// ── Core fetch wrapper ──
export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body — will be stringified */
  body?: unknown;
  /** Skip auth header (for login/register) */
  noAuth?: boolean;
  /** Skip auto-refresh retry on 401 */
  skipRefresh?: boolean;
}

// ── Debug instrumentation callback ──
let _onDebugEntry: ((entry: { method: string; url: string; status: number; requestId: string | null; ms: number; payload?: unknown }) => void) | null = null;

export function setDebugCallback(cb: typeof _onDebugEntry) {
  _onDebugEntry = cb;
}

export async function api<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { body, noAuth, skipRefresh, headers: extraHeaders, ...rest } = opts;

  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const method = (rest.method ?? 'GET').toUpperCase();
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string>),
  };

  if (!noAuth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const fetchOpts: RequestInit = {
    ...rest,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let res = await fetch(url, fetchOpts);

  // ── Auto-refresh on 401 ──
  if (res.status === 401 && !skipRefresh && !path.includes('/auth/refresh')) {
    const refreshOk = await tryRefresh();
    if (refreshOk) {
      // Retry with new token
      if (_accessToken) {
        headers['Authorization'] = `Bearer ${_accessToken}`;
      }
      res = await fetch(url, { ...fetchOpts, headers });
    } else {
      // Refresh failed → force logout
      setAccessToken(null);
      _onForceLogout?.();
      throw makeApiError(res, 'SESSION_EXPIRED', 'Session expired. Please login again.');
    }
  }

  // ── Parse response ──
  const requestId = res.headers.get('x-request-id') ?? null;
  const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);

  if (!res.ok) {
    let payload: Record<string, unknown> = {};
    try {
      payload = await res.json();
    } catch {
      // non-JSON error body
    }

    const error: ApiError = {
      code: (payload.code as string) ?? (payload.error as string) ?? `HTTP_${res.status}`,
      message: (payload.message as string) ?? res.statusText ?? 'Unknown error',
      requestId,
      details: payload.details ?? payload,
      status: res.status,
    };

    // ── Push to debug panel ──
    _onDebugEntry?.({ method, url, status: res.status, requestId, ms, payload });

    throw error;
  }

  // 204 No Content
  if (res.status === 204) {
    _onDebugEntry?.({ method, url, status: 204, requestId, ms });
    return undefined as T;
  }

  const data = await res.json();

  // ── Push successful call to debug panel ──
  _onDebugEntry?.({ method, url, status: res.status, requestId, ms, payload: data });

  return data as T;
}

function makeApiError(res: Response, code: string, message: string): ApiError {
  return {
    code,
    message,
    requestId: res.headers.get('x-request-id') ?? null,
    details: null,
    status: res.status,
  };
}

// ── Convenience methods ──
export const apiGet = <T = unknown>(path: string, opts?: RequestOptions) =>
  api<T>(path, { method: 'GET', ...opts });

export const apiPost = <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
  api<T>(path, { method: 'POST', body, ...opts });

export const apiPatch = <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
  api<T>(path, { method: 'PATCH', body, ...opts });

export const apiDelete = <T = unknown>(path: string, opts?: RequestOptions) =>
  api<T>(path, { method: 'DELETE', ...opts });

export { isApiError };
