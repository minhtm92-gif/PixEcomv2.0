import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LynsieCharm — Charm Your World',
  description: 'Premium jewelry & accessories. Free shipping on orders over $50.',
};

// Storefront layout: light theme — overrides dark globals.css body
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#ffffff', color: '#111111', minHeight: '100vh' }}>
      {children}
    </div>
  );
}
