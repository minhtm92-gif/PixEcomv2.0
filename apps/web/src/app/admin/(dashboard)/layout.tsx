'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminMobileHeader } from '@/components/AdminMobileHeader';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);

  useEffect(() => {
    if (IS_PREVIEW) return;
    if (!initializing && (!user || !user.isSuperadmin)) {
      router.replace('/admin');
    }
  }, [initializing, user, router]);

  // Preview mode: always render content, skip auth
  if (IS_PREVIEW) {
    return (
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <AdminMobileHeader />
        <main className="flex-1 min-w-0 md:ml-56 mt-14 md:mt-0">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    );
  }

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
      <AdminMobileHeader />
      <main className="flex-1 min-w-0 md:ml-56 mt-14 md:mt-0">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
