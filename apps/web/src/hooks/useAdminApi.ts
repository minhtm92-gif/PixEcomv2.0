/**
 * useAdminApi — Generic data-fetching hook for admin pages.
 *
 * Handles loading, error, and data states with automatic refetch capability.
 * Works with the existing apiGet client (JWT auto-refresh, timeout, etc.).
 *
 * Usage:
 *   const { data, loading, error, refetch } = useAdminApi<SellerListResponse>('/admin/sellers?page=1&limit=20');
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';

export interface UseAdminApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminApi<T>(
  path: string | null, // pass null to skip fetching
  deps: unknown[] = [],
): UseAdminApiResult<T> {
  const initializing = useAuthStore((s) => s.initializing);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }

    // Wait for auth to finish before making authenticated API calls.
    // This prevents a double-refresh race condition where useAdminApi
    // and ensureSession() both call /auth/refresh simultaneously,
    // causing refresh-token rotation to invalidate one of them.
    if (initializing) {
      return;
    }

    // Abort previous request if still in flight
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    apiGet<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const apiErr = err as ApiError;
        if (apiErr.code === 'REQUEST_TIMEOUT') {
          setError('Request timed out. Please try again.');
        } else if (apiErr.code === 'NETWORK_ERROR') {
          setError('Network error — is the API server running?');
        } else if (apiErr.code === 'SESSION_EXPIRED') {
          setError('Session expired. Please login again.');
        } else {
          setError(apiErr.message ?? 'Unknown error');
        }
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, initializing, ...deps]);

  return { data, loading, error, refetch };
}

/**
 * useAdminMutation — For POST/PATCH/DELETE actions.
 */
import { apiPost, apiPatch, apiDelete } from '@/lib/apiClient';

export type MutationMethod = 'POST' | 'PATCH' | 'DELETE';

export interface UseAdminMutationResult<T> {
  mutate: (body?: unknown) => Promise<T>;
  loading: boolean;
  error: string | null;
}

export function useAdminMutation<T = unknown>(
  path: string,
  method: MutationMethod = 'POST',
): UseAdminMutationResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body?: unknown): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        let result: T;
        switch (method) {
          case 'POST':
            result = await apiPost<T>(path, body);
            break;
          case 'PATCH':
            result = await apiPatch<T>(path, body);
            break;
          case 'DELETE':
            result = await apiDelete<T>(path);
            break;
        }
        return result;
      } catch (err) {
        const apiErr = err as ApiError;
        const msg = apiErr.message ?? 'Unknown error';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [path, method],
  );

  return { mutate, loading, error };
}
