'use client';

import { useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import type { HealthResponse } from '@/types/api';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export default function HealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetch(`${BASE}/health`, { method: 'GET' });
      const data: HealthResponse = await res.json();
      setHealth(data);
      setMs(Math.round(performance.now() - t0));
    } catch (err) {
      setError((err as Error).message ?? 'Connection failed');
      setMs(Math.round(performance.now() - t0));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Activity size={22} />
          Health Check
        </h1>

        <button
          onClick={check}
          disabled={loading}
          className="mb-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm
                     hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Checking...' : 'Run Health Check'}
        </button>

        <p className="text-xs text-muted-foreground mb-4">
          Endpoint: <code className="text-primary">{BASE}/health</code>
        </p>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {health && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <StatusRow
              label="Overall"
              value={health.status}
              ok={health.status === 'ok'}
            />
            <StatusRow
              label="Database"
              value={health.db}
              ok={health.db === 'connected'}
            />
            <StatusRow
              label="Redis"
              value={health.redis}
              ok={health.redis === 'connected'}
            />
            <div className="border-t border-border pt-3 space-y-1 text-xs">
              <InfoRow label="Service" value={health.service} />
              <InfoRow label="Request ID" value={health.requestId} />
              <InfoRow label="Timestamp" value={health.timestamp} />
              {ms !== null && <InfoRow label="Latency" value={`${ms}ms`} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${ok ? 'text-green-400' : 'text-red-400'}`}>
        {value}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono">{value}</span>
    </div>
  );
}
