'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Sidebar } from '@/components/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Portal layout — wraps all authenticated pages.
 *
 * Route guard logic:
 *  1. While `initializing` is true → show skeleton, DO NOT redirect.
 *  2. Once `initializing` is false:
 *     - user exists → render portal
 *     - user is null → redirect to /login
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);

  useEffect(() => {
    if (!initializing && !user) {
      router.replace('/login');
    }
  }, [initializing, user, router]);

  if (initializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm animate-pulse">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-56">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
