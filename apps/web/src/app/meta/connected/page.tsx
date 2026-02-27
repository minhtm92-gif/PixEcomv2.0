'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

export default function MetaConnectedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/settings');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-card border border-border rounded-xl p-8 max-w-sm w-full mx-4 text-center">
        <CheckCircle2 size={40} className="mx-auto text-green-400 mb-4" />
        <h1 className="text-lg font-semibold text-foreground mb-2">Connected!</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Facebook account linked successfully.
        </p>
        <p className="text-xs text-muted-foreground">
          Redirecting to Settings in {countdown}s...
        </p>
        <button
          onClick={() => router.push('/settings')}
          className="mt-4 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          Go to Settings now
        </button>
      </div>
    </div>
  );
}
