'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { toastApiError, useToastStore } from '@/stores/toastStore';

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? '';
const DEMO_PASS = process.env.NEXT_PUBLIC_DEMO_PASS ?? '';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const addToast = useToastStore((s) => s.add);

  // If ensureSession() restored a valid session, redirect based on role
  useEffect(() => {
    if (!initializing && user) {
      if (!user.isSuperadmin) {
        router.replace('/orders');
      }
      // If admin is logged in, we show a message below instead of redirecting
    }
  }, [initializing, user, router]);

  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      addToast('Login successful', 'success');
      router.push('/orders');
    } catch (err: unknown) {
      const errObj = err as { message?: string; code?: string; status?: number };
      const msg = errObj?.message ?? 'Login failed';
      setError(msg);
      toastApiError(errObj);
    } finally {
      setLoading(false);
    }
  }

  // Admin is logged in — show redirect message
  if (!initializing && user?.isSuperadmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">PixEcom</h1>
          <p className="text-muted-foreground text-sm mb-6">Seller Portal v2</p>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-4">
              You are logged in as an admin. Please sign in at the admin portal.
            </p>
            <a
              href="/admin"
              className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors"
            >
              Go to Admin Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">PixEcom</h1>
          <p className="text-muted-foreground text-sm mt-1">Seller Portal v2</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm text-muted-foreground mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50
                           focus:border-primary transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm text-muted-foreground mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50
                           focus:border-primary transition-colors"
                placeholder="Password"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo hint */}
          {DEMO_EMAIL && (
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Demo credentials are pre-filled from env
            </p>
          )}
        </div>

        {/* Debug link */}
        <div className="mt-4 text-center">
          <a href="/debug/api" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            API Debug Console &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
