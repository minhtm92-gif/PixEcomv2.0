'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

/**
 * Root page — redirects to /products if logged in, /login otherwise.
 */
export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/orders' : '/login');
    }
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">PixEcom v2</h1>
        <p className="mt-2 text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
