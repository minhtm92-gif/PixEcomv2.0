/**
 * API Client — single fetch wrapper for all backend calls.
 *
 * Features:
 *  - Base URL from NEXT_PUBLIC_API_BASE_URL (no localhost fallback!)
 *  - credentials: "include" (sends refresh_token cookie)
 *  - Attaches Authorization: Bearer <accessToken> if present
 *  - Auto-refresh on 401: calls POST /auth/refresh, retries once
 *  - Normalised error shape: { code, message, requestId, details, status }
 *
 * IMPORTANT: NEXT_PUBLIC_API_BASE_URL is injected at BUILD TIME by Next.js.
 * After changing .env.local you MUST rebuild (pnpm build / pnpm dev restart).
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

// ── Runtime env guard ──
export function validateApiBase(): string | null {
  if (!BASE || BASE.trim() === '') {
    return 'NEXT_PUBLIC_API_BASE_URL is not set. Rebuild with the correct .env.local.';
  }
  if (BASE.includes('localhost') || BASE.includes('127.0.0.1')) {
    return `NEXT_PUBLIC_API_BASE_URL points to localhost (${BASE}). For staging, set it to the staging API URL and rebuild.`;
  }
  return null;
}

/** The resolved API base URL (read-only) */
export function getApiBaseUrl(): string {
  return BASE;
}

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
// Resolves to:
//   'ok'       — refresh succeeded, new accessToken is set
//   'expired'  — refresh endpoint returned 401 (session truly dead)
//   'error'    — transient failure (5xx / network), do not force-logout
type RefreshResult = 'ok' | 'expired' | 'error';
let _refreshPromise: Promise<RefreshResult> | null = null;

async function tryRefresh(): Promise<RefreshResult> {
  // Deduplicate: if a refresh is already in flight, await it — all concurrent
  // callers share the result and retry with whatever token it produced.
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async (): Promise<RefreshResult> => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        // Refresh token invalid/expired — session is truly dead
        return 'expired';
      }
      if (!res.ok) {
        // Transient server error — don't force-logout
        return 'error';
      }
      const data = await res.json();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return 'ok';
      }
      return 'error';
    } catch {
      // Network error — treat as transient, not session expiry
      return 'error';
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
    const originalRes = res;
    const refreshResult = await tryRefresh();
    if (refreshResult === 'ok') {
      // Retry with the new access token
      if (_accessToken) {
        headers['Authorization'] = `Bearer ${_accessToken}`;
      }
      res = await fetch(url, { ...fetchOpts, headers });
    } else if (refreshResult === 'expired') {
      // Refresh token is dead — force logout
      setAccessToken(null);
      _onForceLogout?.();
      throw makeApiError(originalRes, 'SESSION_EXPIRED', 'Session expired. Please login again.');
    } else {
      // Transient error — surface the original 401, do NOT force-logout
      res = originalRes;
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
