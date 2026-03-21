import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
};

export default function StoreNotFound() {
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
      <div
        style={{
          fontSize: '6rem',
          fontWeight: 800,
          color: '#e5e7eb',
          lineHeight: 1,
          marginBottom: '0.5rem',
        }}
      >
        404
      </div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#111',
          marginBottom: '0.5rem',
        }}
      >
        Page not found
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
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <a
        href="/"
        style={{
          padding: '0.625rem 1.5rem',
          backgroundColor: '#111',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          fontWeight: 600,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        Back to store
      </a>
    </div>
  );
}
