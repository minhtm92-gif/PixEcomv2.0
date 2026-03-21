'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * AuthProvider — runs ensureSession() on mount.
 * Renders children immediately — the portal route guard handles gating.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const ensureSession = useAuthStore((s) => s.ensureSession);

  useEffect(() => {
    ensureSession();
  }, [ensureSession]);

  return <>{children}</>;
}
