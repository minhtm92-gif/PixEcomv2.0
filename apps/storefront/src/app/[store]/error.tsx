'use client';

import { useEffect } from 'react';

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Storefront error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
        :(
      </div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#111',
          marginBottom: '0.5rem',
        }}
      >
        Something went wrong
      </h1>
      <p
        style={{
          fontSize: '1rem',
          color: '#666',
          marginBottom: '1.5rem',
          textAlign: 'center',
          maxWidth: '400px',
        }}
      >
        We encountered an unexpected error. Please try again or return to the
        homepage.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={reset}
          style={{
            padding: '0.625rem 1.5rem',
            backgroundColor: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            padding: '0.625rem 1.5rem',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
