import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | PixEcom',
    default: 'Shop | PixEcom',
  },
  description: 'Premium products at great prices. Free shipping on orders over $50.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: '#ffffff', color: '#111111', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
