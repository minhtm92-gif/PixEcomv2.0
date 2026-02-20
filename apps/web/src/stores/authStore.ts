/**
 * Auth Store — Zustand store for authentication state.
 *
 * Contract alignment:
 *  POST /auth/login   → { accessToken, user: { id, email, displayName }, seller: { id, name, slug } }
 *  GET  /auth/me      → { id, email, displayName, avatarUrl, sellerId, role } (FLAT — no nesting)
 *  POST /auth/refresh → { accessToken }
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
}

interface AuthState {
  user: AuthUser | null;
  seller: AuthSeller | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  me: () => Promise<boolean>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  setForceLogoutCallback(() => {
    set({ user: null, seller: null, error: null });
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  });

  return {
    user: null,
    seller: null,
    loading: false,
    error: null,
    hydrated: false,

    login: async (email: string, password: string) => {
      set({ loading: true, error: null });
      try {
        const data = await apiPost<{
          accessToken: string;
          user: AuthUser;
          seller: AuthSeller;
        }>('/auth/login', { email, password }, { noAuth: true });

        setAccessToken(data.accessToken);
        set({ user: data.user, seller: data.seller, loading: false });
        return true;
      } catch (err) {
        const e = err as ApiError;
        set({ loading: false, error: e.message || 'Login failed' });
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

    /** GET /auth/me returns a FLAT object — map to user shape */
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
          },
          loading: false,
        });
        return true;
      } catch {
        set({ loading: false });
        return false;
      }
    },

    hydrate: async () => {
      if (get().hydrated) return;
      set({ loading: true });
      try {
        const refresh = await apiPost<{ accessToken: string }>(
          '/auth/refresh',
          undefined,
          { noAuth: true, skipRefresh: true },
        );
        setAccessToken(refresh.accessToken);
        const me = await apiGet<MeResponse>('/auth/me');
        set({
          user: {
            id: me.id,
            email: me.email,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
            sellerId: me.sellerId,
            role: me.role,
          },
          loading: false,
          hydrated: true,
        });
      } catch {
        setAccessToken(null);
        set({ user: null, seller: null, loading: false, hydrated: true });
      }
    },

    clearError: () => set({ error: null }),
  };
});
