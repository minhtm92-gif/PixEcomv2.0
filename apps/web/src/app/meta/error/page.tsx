'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';

const REASON_MESSAGES: Record<string, string> = {
  denied: 'You denied the Facebook authorization request.',
  token_expired: 'The authorization session has expired. Please try again.',
  invalid_request: 'The authorization request was invalid. Please try again.',
  server_error: 'An unexpected error occurred. Please try again later.',
};

function MetaErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const reason = searchParams.get('reason') ?? 'server_error';
  const message = REASON_MESSAGES[reason] ?? REASON_MESSAGES.server_error;

  return (
    <div className="bg-card border border-border rounded-xl p-8 max-w-sm w-full mx-4 text-center">
      <XCircle size={40} className="mx-auto text-red-400 mb-4" />
      <h1 className="text-lg font-semibold text-foreground mb-2">Connection Failed</h1>
      <p className="text-sm text-red-400 mb-6">{message}</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => router.push('/settings')}
          className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          Back to Settings
        </button>
        <button
          onClick={() => router.push('/settings')}
          className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-medium hover:bg-[#1877F2]/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default function MetaErrorPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Suspense
        fallback={
          <div className="bg-card border border-border rounded-xl p-8 max-w-sm w-full mx-4 text-center">
            <XCircle size={40} className="mx-auto text-red-400 mb-4" />
            <h1 className="text-lg font-semibold text-foreground mb-2">Connection Failed</h1>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <MetaErrorContent />
      </Suspense>
    </div>
  );
}
