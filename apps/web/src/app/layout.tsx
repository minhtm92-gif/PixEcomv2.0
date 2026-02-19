import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PixEcom — Seller Portal',
  description: 'PixEcom v2 Seller Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
