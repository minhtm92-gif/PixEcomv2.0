'use client';

import { useState, useCallback } from 'react';
import { api, apiGet, apiPost, getAccessToken, setAccessToken } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

/* ── Types ── */
interface TestResult {
  name: string;
  status: 'idle' | 'running' | 'pass' | 'fail';
  ms?: number;
  statusCode?: number;
  data?: unknown;
  error?: string;
}

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? 'demo@pixecom.io';
const DEMO_PASS = process.env.NEXT_PUBLIC_DEMO_PASS ?? 'Password123!';

/* ── Individual test runners ── */
async function runTest(
  name: string,
  fn: () => Promise<{ statusCode?: number; data?: unknown }>,
): Promise<TestResult> {
  const t0 = performance.now();
  try {
    const result = await fn();
    return {
      name,
      status: 'pass',
      ms: Math.round(performance.now() - t0),
      statusCode: result.statusCode,
      data: result.data,
    };
  } catch (err: unknown) {
    const ms = Math.round(performance.now() - t0);
    const errObj = err as Record<string, unknown>;
    return {
      name,
      status: 'fail',
      ms,
      statusCode: (errObj?.status as number) ?? 0,
      error: (errObj?.message as string) ?? String(err),
    };
  }
}

/* ── Component ── */
export default function DebugApiPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const seller = useAuthStore((s) => s.seller);
  const addToast = useToastStore((s) => s.add);

  const updateResult = useCallback((idx: number, result: TestResult) => {
    setResults((prev) => {
      const next = [...prev];
      next[idx] = result;
      return next;
    });
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);

    // Define all tests
    const tests: { name: string; fn: () => Promise<{ statusCode?: number; data?: unknown }> }[] = [
      {
        name: '1. Health check — GET /health',
        fn: async () => {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api'}/../health`,
            { method: 'GET' },
          );
          const data = await res.json().catch(() => res.statusText);
          if (!res.ok) throw { status: res.status, message: `HTTP ${res.status}` };
          return { statusCode: res.status, data };
        },
      },
      {
        name: '2. CORS preflight — OPTIONS /auth/login',
        fn: async () => {
          const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
          const res = await fetch(`${base}/auth/login`, {
            method: 'OPTIONS',
            credentials: 'include',
          });
          return {
            statusCode: res.status,
            data: {
              'access-control-allow-origin': res.headers.get('access-control-allow-origin'),
              'access-control-allow-credentials': res.headers.get('access-control-allow-credentials'),
              'access-control-allow-methods': res.headers.get('access-control-allow-methods'),
            },
          };
        },
      },
      {
        name: `3. Login — POST /auth/login (${DEMO_EMAIL})`,
        fn: async () => {
          await login(DEMO_EMAIL, DEMO_PASS);
          const token = getAccessToken();
          return {
            statusCode: 200,
            data: {
              hasAccessToken: !!token,
              tokenPrefix: token ? token.substring(0, 20) + '...' : null,
              user: useAuthStore.getState().user,
              seller: useAuthStore.getState().seller,
            },
          };
        },
      },
      {
        name: '4. Auth check — GET /auth/me',
        fn: async () => {
          const data = await apiGet('/auth/me');
          return { statusCode: 200, data };
        },
      },
      {
        name: '5. Token refresh — POST /auth/refresh',
        fn: async () => {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api'}/auth/refresh`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            },
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw { status: res.status, message: data.message ?? `HTTP ${res.status}` };
          if (data.accessToken) setAccessToken(data.accessToken);
          return {
            statusCode: res.status,
            data: { hasNewToken: !!data.accessToken },
          };
        },
      },
      {
        name: '6. Products — GET /products?page=1&limit=5',
        fn: async () => {
          const data = await apiGet('/products?page=1&limit=5');
          return { statusCode: 200, data };
        },
      },
      {
        name: '7. Sellpages — GET /sellpages?page=1&limit=5',
        fn: async () => {
          const data = await apiGet('/sellpages?page=1&limit=5');
          return { statusCode: 200, data };
        },
      },
      {
        name: '8. Orders — GET /orders?limit=5',
        fn: async () => {
          const data = await apiGet('/orders?limit=5');
          return { statusCode: 200, data };
        },
      },
      {
        name: '9. Ads campaigns — GET /ads-manager/campaigns',
        fn: async () => {
          const data = await apiGet('/ads-manager/campaigns');
          return { statusCode: 200, data };
        },
      },
      {
        name: '10. Logout — POST /auth/logout',
        fn: async () => {
          await logout();
          return {
            statusCode: 200,
            data: {
              hasAccessToken: !!getAccessToken(),
              user: useAuthStore.getState().user,
            },
          };
        },
      },
    ];

    // Initialise results
    const initial: TestResult[] = tests.map((t) => ({
      name: t.name,
      status: 'idle' as const,
    }));
    setResults(initial);

    // Run sequentially (login → auth → resources → logout)
    for (let i = 0; i < tests.length; i++) {
      updateResult(i, { name: tests[i].name, status: 'running' });
      const result = await runTest(tests[i].name, tests[i].fn);
      updateResult(i, result);

      // If login fails, skip auth-dependent tests
      if (i === 2 && result.status === 'fail') {
        for (let j = 3; j < tests.length; j++) {
          updateResult(j, {
            name: tests[j].name,
            status: 'fail',
            error: 'Skipped — login failed',
          });
        }
        break;
      }
    }

    setRunning(false);
    addToast('Test suite complete', 'info');
  }, [login, logout, updateResult, addToast]);

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const total = results.length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">API Connectivity Debug</h1>
          <p className="text-muted-foreground text-sm">
            Tests all backend endpoints sequentially. Login → Auth → Resources → Logout.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            API Base: <code className="text-primary">{process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api'}</code>
          </p>
        </div>

        {/* Current auth state */}
        <div className="mb-6 p-4 rounded-lg bg-card border border-border">
          <h2 className="text-sm font-medium text-foreground mb-2">Current Auth State</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">User:</span>{' '}
              <span className="text-foreground">{user ? `${user.displayName} (${user.email})` : 'Not logged in'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Seller:</span>{' '}
              <span className="text-foreground">{seller ? `${seller.name} (${seller.slug})` : 'None'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Access Token:</span>{' '}
              <span className="text-foreground">{getAccessToken() ? 'Present' : 'None'}</span>
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runAll}
          disabled={running}
          className="mb-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm
                     hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {running ? 'Running...' : 'Run All Tests'}
        </button>

        {/* Summary bar */}
        {total > 0 && (
          <div className="mb-4 flex gap-4 text-sm">
            <span className="text-foreground font-medium">{total} tests</span>
            <span className="text-green-400">{passCount} pass</span>
            <span className="text-red-400">{failCount} fail</span>
            {running && <span className="text-yellow-400 animate-pulse">Running...</span>}
          </div>
        )}

        {/* Results */}
        <div className="space-y-2">
          {results.map((r, i) => (
            <ResultRow key={i} result={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Result Row ── */
function ResultRow({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(false);

  const statusBadge = {
    idle: 'bg-gray-700 text-gray-300',
    running: 'bg-yellow-600 text-yellow-100 animate-pulse',
    pass: 'bg-green-600 text-green-100',
    fail: 'bg-red-600 text-red-100',
  }[result.status];

  const statusLabel = {
    idle: 'IDLE',
    running: 'RUN',
    pass: 'PASS',
    fail: 'FAIL',
  }[result.status];

  return (
    <div className="rounded-lg bg-card border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${statusBadge}`}>
          {statusLabel}
        </span>
        <span className="text-sm text-foreground flex-1">{result.name}</span>
        {result.ms !== undefined && (
          <span className="text-xs text-muted-foreground">{result.ms}ms</span>
        )}
        {result.statusCode !== undefined && (
          <span className="text-xs text-muted-foreground">HTTP {result.statusCode}</span>
        )}
        <span className="text-muted-foreground text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          {result.error && (
            <div className="mb-2">
              <span className="text-xs font-medium text-red-400">Error: </span>
              <span className="text-xs text-red-300">{result.error}</span>
            </div>
          )}
          {result.data !== undefined && (
            <pre className="text-xs text-muted-foreground overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
          {!result.error && result.data === undefined && (
            <span className="text-xs text-muted-foreground">No data</span>
          )}
        </div>
      )}
    </div>
  );
}
