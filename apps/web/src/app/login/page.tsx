'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';

const PIXHUB_LOGIN = process.env.NEXT_PUBLIC_PIXHUB_LOGIN_URL || 'https://hub.pixelxlab.com/login';

export default function LoginPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);

  useEffect(() => {
    if (initializing) return;

    // Already logged in — go to app
    if (user) {
      router.replace(user.isSuperadmin ? '/admin' : '/orders');
      return;
    }

    // Not logged in — redirect to PixHub SSO
    window.location.href = `${PIXHUB_LOGIN}?redirect_app=PIXECOM`;
  }, [initializing, user, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">PixEcom</h1>
        <p className="text-muted-foreground text-sm">Redirecting to PixHub login...</p>
        <div className="mt-4 animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
      </div>
    </div>
  );
}
