'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { Shield } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const adminLogin = useAuthStore((s) => s.adminLogin);
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const addToast = useToastStore((s) => s.add);

  // Already authenticated — redirect based on role
  useEffect(() => {
    if (!initializing && user) {
      if (user.isSuperadmin) {
        router.replace('/admin/dashboard');
      }
      // If seller is logged in, we show a message (handled below)
    }
  }, [initializing, user, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await adminLogin(email, password);
      addToast('Admin login successful', 'success');
      router.push('/admin/dashboard');
    } catch (err: unknown) {
      const errObj = err as { message?: string; code?: string; status?: number };
      const msg = errObj?.message ?? 'Admin login failed';
      setError(msg);
      toastApiError(errObj);
    } finally {
      setLoading(false);
    }
  }

  // Seller is logged in — show conflict message
  if (!initializing && user && !user.isSuperadmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">PixEcom Admin</h1>
            <p className="text-amber-400 text-sm mt-1">Platform Administration</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Shield size={24} className="text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              You are currently logged in as a seller ({user.email}). Please log out first to access admin login.
            </p>
            <a
              href="/login"
              className="inline-block px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors"
            >
              Go to Seller Portal
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
          <h1 className="text-3xl font-bold text-foreground">PixEcom Admin</h1>
          <p className="text-amber-400 text-sm mt-1">Platform Administration</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-amber-500/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
            <Shield size={18} className="text-amber-400" />
            Admin Sign in
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="admin-email" className="block text-sm text-muted-foreground mb-1.5">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50
                           focus:border-amber-500 transition-colors"
                placeholder="admin@pixecom.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="admin-password" className="block text-sm text-muted-foreground mb-1.5">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50
                           focus:border-amber-500 transition-colors"
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
              className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-medium text-sm
                         hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in as Admin'}
            </button>
          </form>
        </div>

        {/* Back to seller login */}
        <div className="mt-4 text-center">
          <a href="/login" className="text-xs text-muted-foreground hover:text-amber-400 transition-colors">
            &larr; Seller Portal Login
          </a>
        </div>
      </div>
    </div>
  );
}
