import type { Metadata } from 'next';
import { AuthProvider } from '@/components/AuthProvider';
import { Toaster } from '@/components/Toaster';
import { DebugPanel } from '@/components/DebugPanel';
import { EnvGuard } from '@/components/EnvGuard';
import './globals.css';

export const metadata: Metadata = {
  title: 'PixEcom — Seller Portal',
  description: 'PixEcom v2 Seller Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <EnvGuard>
          <AuthProvider>
            {children}
            <Toaster />
            <DebugPanel />
          </AuthProvider>
        </EnvGuard>
      </body>
    </html>
  );
}
