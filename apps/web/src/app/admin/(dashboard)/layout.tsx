'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { AdminSidebar } from '@/components/AdminSidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Shield } from 'lucide-react';

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
        <div className="hidden lg:block">
          <AdminSidebar />
        </div>
        <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-50">
          <Shield size={18} className="text-amber-400 mr-2" />
          <span className="text-sm font-bold text-foreground">PixEcom Admin</span>
          <span className="ml-auto text-xs text-muted-foreground">Desktop recommended</span>
        </div>
        <main className="flex-1 lg:ml-56 mt-14 lg:mt-0">
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
      <main className="flex-1 ml-56">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
