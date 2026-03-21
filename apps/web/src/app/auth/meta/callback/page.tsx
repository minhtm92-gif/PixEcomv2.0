'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { useToastStore } from '@/stores/toastStore';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type CallbackStatus = 'processing' | 'success' | 'error';

function MetaCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addToast = useToastStore((s) => s.add);

  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const fbError = searchParams.get('error');

      if (fbError) {
        const desc = searchParams.get('error_description') ?? 'Authorization was denied';
        setStatus('error');
        setErrorMessage(desc);
        addToast(`Facebook auth failed: ${desc}`, 'error');
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMessage('Missing authorization code from Facebook');
        addToast('Facebook auth failed: missing code', 'error');
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set('code', code);
        if (state) params.set('state', state);

        await apiGet(`/meta/callback?${params.toString()}`);

        setStatus('success');
        addToast('Facebook connected successfully', 'success');

        setTimeout(() => {
          router.push('/settings');
        }, 2000);
      } catch (err) {
        const e = err as ApiError;
        setStatus('error');
        setErrorMessage(e.message ?? 'Failed to complete Facebook authorization');
        addToast(`Facebook auth failed: ${e.message ?? 'unknown error'}`, 'error');
      }
    }

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-8 max-w-sm w-full mx-4 text-center">
      {status === 'processing' && (
        <>
          <Loader2 size={40} className="mx-auto text-[#1877F2] animate-spin mb-4" />
          <h1 className="text-lg font-semibold text-foreground mb-2">Connecting Facebook</h1>
          <p className="text-sm text-muted-foreground">
            Processing your authorization...
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 size={40} className="mx-auto text-green-400 mb-4" />
          <h1 className="text-lg font-semibold text-foreground mb-2">Connected!</h1>
          <p className="text-sm text-muted-foreground">
            Facebook account linked successfully. Redirecting to Settings...
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={40} className="mx-auto text-red-400 mb-4" />
          <h1 className="text-lg font-semibold text-foreground mb-2">Connection Failed</h1>
          <p className="text-sm text-red-400 mb-4">{errorMessage}</p>
          <button
            onClick={() => router.push('/settings')}
            className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            Back to Settings
          </button>
        </>
      )}
    </div>
  );
}

export default function MetaCallbackPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Suspense
        fallback={
          <div className="bg-card border border-border rounded-xl p-8 max-w-sm w-full mx-4 text-center">
            <Loader2 size={40} className="mx-auto text-[#1877F2] animate-spin mb-4" />
            <h1 className="text-lg font-semibold text-foreground mb-2">Connecting Facebook</h1>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <MetaCallbackContent />
      </Suspense>
    </div>
  );
}
