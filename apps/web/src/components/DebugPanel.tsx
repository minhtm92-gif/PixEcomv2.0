'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bug, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { setDebugCallback } from '@/lib/apiClient';

interface DebugEntry {
  method: string;
  url: string;
  status: number;
  requestId: string | null;
  ms: number;
  payload?: unknown;
}

/** Global debug log — append from apiClient callback */
const _debugLog: DebugEntry[] = [];
let _listeners: Set<() => void> = new Set();

function pushEntry(entry: DebugEntry) {
  _debugLog.unshift(entry);
  if (_debugLog.length > 50) _debugLog.pop();
  _listeners.forEach((l) => l());
}

function useDebugLog() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    _listeners.add(cb);
    return () => { _listeners.delete(cb); };
  }, []);

  return _debugLog;
}

export function DebugPanel() {
  const log = useDebugLog();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Wire apiClient → debug log on mount
  useEffect(() => {
    setDebugCallback(pushEntry);
    return () => setDebugCallback(null);
  }, []);

  // Only render in dev
  if (process.env.NODE_ENV !== 'development') return null;

  const lastOk = log.length > 0 && log[0].status >= 200 && log[0].status < 300;

  return (
    <div className="fixed bottom-0 right-0 z-[9998] w-[440px] max-h-[50vh] flex flex-col bg-[#0a0a14] border border-border rounded-tl-xl shadow-2xl text-xs">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground"
      >
        <Bug size={14} />
        <span className="font-medium">API Debug</span>
        {log.length > 0 && (
          <span className={`ml-1 w-2 h-2 rounded-full ${lastOk ? 'bg-green-400' : 'bg-red-400'}`} />
        )}
        <span className="ml-auto text-[10px]">{log.length} calls</span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {open && (
        <div className="overflow-y-auto flex-1 border-t border-border">
          {log.length === 0 && (
            <p className="p-3 text-muted-foreground">No API calls yet. Navigate or interact to see requests.</p>
          )}
          {log.map((entry, i) => {
            const ok = entry.status >= 200 && entry.status < 300;
            return (
              <div
                key={`${i}-${entry.ms}`}
                className="border-b border-border last:border-0 px-3 py-2 hover:bg-muted/30 cursor-pointer"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${ok ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.status}
                  </span>
                  <span className="text-muted-foreground font-mono">{entry.method}</span>
                  <span className="text-foreground truncate flex-1">{entry.url.replace(/https?:\/\/[^/]+\/api/, '')}</span>
                  <span className="text-muted-foreground">{entry.ms}ms</span>
                </div>
                {entry.requestId && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">x-request-id: {entry.requestId}</p>
                )}
                {expanded === i && entry.payload !== undefined && (
                  <pre className="mt-2 text-[10px] text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap bg-muted/20 p-2 rounded">
                    {JSON.stringify(entry.payload, null, 2)?.substring(0, 2000)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
