'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { validateApiBase, getApiBaseUrl } from '@/lib/apiClient';

/**
 * Full-screen blocker when NEXT_PUBLIC_API_BASE_URL is missing or points to localhost.
 * Renders children only when the env is valid.
 *
 * NOTE: Next.js injects NEXT_PUBLIC_* at BUILD time.
 * After changing .env.local you must rebuild (pnpm build / restart pnpm dev).
 */
export function EnvGuard({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const err = validateApiBase();
    if (err) {
      // Log prominently so devs see it in the console
      console.error('[EnvGuard] API base URL misconfigured:', err);
      console.error('[EnvGuard] Current value:', getApiBaseUrl() || '(empty)');
      setError(err);
    }
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-[99999] bg-background flex items-center justify-center p-8">
        <div className="max-w-lg w-full bg-card border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="flex justify-center mb-4">
            <AlertTriangle size={48} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            API Configuration Error
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {error}
          </p>

          <div className="bg-muted/40 border border-border rounded-lg p-4 text-left text-xs font-mono space-y-2 mb-6">
            <p className="text-muted-foreground">
              <span className="text-foreground">Current value:</span>{' '}
              <code className="text-red-400">{getApiBaseUrl() || '(not set)'}</code>
            </p>
            <p className="text-muted-foreground">
              <span className="text-foreground">Expected:</span>{' '}
              <code className="text-green-400">https://api-staging.pixelxlab.com/api</code>
            </p>
          </div>

          <div className="text-left text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground mb-1">Fix:</p>
            <p>1. Open <code className="text-primary">apps/web/.env.local</code></p>
            <p>2. Set <code className="text-primary">NEXT_PUBLIC_API_BASE_URL=https://api-staging.pixelxlab.com/api</code></p>
            <p>3. Restart dev server: <code className="text-primary">pnpm dev</code></p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
