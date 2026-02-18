import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PixEcom — Seller Portal',
  description: 'PixEcom v2 Seller Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
