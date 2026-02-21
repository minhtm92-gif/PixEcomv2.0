'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { AdminSidebar } from '@/components/AdminSidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Admin dashboard layout — wraps all admin authenticated pages.
 *
 * Route guard logic:
 *  1. While `initializing` is true → show skeleton, DO NOT redirect.
 *  2. Once `initializing` is false:
 *     - user exists AND isSuperadmin → render admin dashboard
 *     - user is null → redirect to /admin (admin login)
 *     - user is seller (not superadmin) → redirect to /admin (shows conflict msg)
 */
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);

  useEffect(() => {
    if (!initializing && (!user || !user.isSuperadmin)) {
      router.replace('/admin');
    }
  }, [initializing, user, router]);

  if (initializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm animate-pulse">Restoring admin session...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isSuperadmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Redirecting to admin login...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 ml-56">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
