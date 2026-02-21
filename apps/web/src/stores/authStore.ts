/**
 * Auth Store — Zustand store for authentication state.
 *
 * Contract alignment:
 *  POST /auth/login   → { accessToken, user: { id, email, displayName }, seller: { id, name, slug } }
 *  GET  /auth/me      → { id, email, displayName, avatarUrl, sellerId, role } (FLAT — no nesting)
 *  POST /auth/refresh → { accessToken }
 *
 * Boot sequence (ensureSession):
 *  1. initializing = true  (blocks route guards from redirecting)
 *  2. POST /auth/refresh   (cookie → new accessToken)
 *  3. GET  /auth/me        (accessToken → user profile)
 *  4. initializing = false  (route guards can now decide)
 */
import { create } from 'zustand';
import {
  apiPost,
  apiGet,
  setAccessToken,
  getAccessToken,
  setForceLogoutCallback,
  type ApiError,
} from '@/lib/apiClient';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  sellerId?: string;
  role?: string;
  isSuperadmin: boolean;
}

export interface AuthSeller {
  id: string;
  name: string;
  slug: string;
}

/** Shape returned by GET /auth/me (flat — no nesting) */
interface MeResponse {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  sellerId: string;
  role: string;
  isSuperadmin?: boolean;
}

/** Boot-step log entry for DebugPanel */
export interface BootStep {
  step: string;
  status: 'start' | 'ok' | 'fail';
  ms?: number;
  detail?: string;
}

interface AuthState {
  user: AuthUser | null;
  seller: AuthSeller | null;
  loading: boolean;
  error: string | null;
  initializing: boolean;
  bootLog: BootStep[];

  login: (email: string, password: string) => Promise<boolean>;
  adminLogin: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  me: () => Promise<boolean>;
  ensureSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  setForceLogoutCallback(() => {
    if (get().initializing) {
      console.warn('[Auth] Force-logout suppressed during initialization');
      return;
    }
    const wasAdmin = get().user?.isSuperadmin;
    set({ user: null, seller: null, error: null });
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      window.location.href = wasAdmin ? '/admin' : '/login';
    }
  });

  return {
    user: null,
    seller: null,
    loading: false,
    error: null,
    initializing: true,
    bootLog: [],

    login: async (email: string, password: string) => {
      set({ loading: true, error: null });
      try {
        const data = await apiPost<{
          accessToken: string;
          user: AuthUser;
          seller: AuthSeller;
        }>('/auth/login', { email, password }, { noAuth: true });

        setAccessToken(data.accessToken);
        const user = { ...data.user, isSuperadmin: data.user.isSuperadmin ?? false };
        set({ user, seller: data.seller, loading: false });
        return true;
      } catch (err) {
        const e = err as ApiError;
        set({ loading: false, error: e.message || 'Login failed' });
        throw err;
      }
    },

    adminLogin: async (email: string, password: string) => {
      set({ loading: true, error: null });
      try {
        const data = await apiPost<{
          accessToken: string;
          user: AuthUser;
        }>('/auth/admin-login', { email, password }, { noAuth: true });

        setAccessToken(data.accessToken);
        const user = { ...data.user, isSuperadmin: true };
        set({ user, seller: null, loading: false });
        return true;
      } catch (err) {
        const e = err as ApiError;
        set({ loading: false, error: e.message || 'Admin login failed' });
        throw err;
      }
    },

    logout: async () => {
      try {
        await apiPost('/auth/logout');
      } catch {
        // ignore
      }
      setAccessToken(null);
      set({ user: null, seller: null, error: null });
    },

    me: async () => {
      if (!getAccessToken()) return false;
      set({ loading: true });
      try {
        const me = await apiGet<MeResponse>('/auth/me');
        set({
          user: {
            id: me.id,
            email: me.email,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
            sellerId: me.sellerId,
            role: me.role,
            isSuperadmin: me.isSuperadmin ?? false,
          },
          loading: false,
        });
        return true;
      } catch {
        set({ loading: false });
        return false;
      }
    },

    ensureSession: async () => {
      if (!get().initializing) return;

      const log: BootStep[] = [];
      const pushLog = (entry: BootStep) => {
        log.push(entry);
        set({ bootLog: [...log] });
      };

      const t0 = performance.now();

      pushLog({ step: 'refresh', status: 'start' });
      try {
        const refresh = await apiPost<{ accessToken: string }>(
          '/auth/refresh',
          undefined,
          { noAuth: true, skipRefresh: true },
        );
        setAccessToken(refresh.accessToken);
        const ms = Math.round(performance.now() - t0);
        pushLog({ step: 'refresh', status: 'ok', ms, detail: 'Token acquired' });
        console.info(`[Auth Boot] refresh OK (${ms}ms)`);
      } catch (err) {
        const ms = Math.round(performance.now() - t0);
        const e = err as ApiError;
        pushLog({ step: 'refresh', status: 'fail', ms, detail: e?.message ?? 'No refresh cookie' });
        console.info(`[Auth Boot] refresh FAIL (${ms}ms) — ${e?.message ?? 'no cookie'}`);
        setAccessToken(null);
        set({ user: null, seller: null, loading: false, initializing: false, bootLog: [...log] });
        return;
      }

      const t1 = performance.now();
      pushLog({ step: 'me', status: 'start' });
      try {
        const me = await apiGet<MeResponse>('/auth/me');
        const ms = Math.round(performance.now() - t1);
        pushLog({ step: 'me', status: 'ok', ms, detail: me.email });
        console.info(`[Auth Boot] /me OK (${ms}ms) — ${me.email}`);
        set({
          user: {
            id: me.id,
            email: me.email,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
            sellerId: me.sellerId,
            role: me.role,
            isSuperadmin: me.isSuperadmin ?? false,
          },
          loading: false,
          initializing: false,
          bootLog: [...log],
        });
      } catch (err) {
        const ms = Math.round(performance.now() - t1);
        const e = err as ApiError;
        pushLog({ step: 'me', status: 'fail', ms, detail: `${e?.status ?? '?'} ${e?.message ?? 'unknown'}` });
        console.warn(`[Auth Boot] /me FAIL (${ms}ms) — ${e?.status} ${e?.message}`);
        setAccessToken(null);
        set({ user: null, seller: null, loading: false, initializing: false, bootLog: [...log] });
      }
    },

    clearError: () => set({ error: null }),
  };
});
