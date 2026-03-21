import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PixEcom — The Sellpage Builder That Tracks Ad Performance',
  description:
    'Build high-converting sellpages, track every Facebook ad click to purchase, and optimize your dropshipping business with real-time analytics.',
  openGraph: {
    title: 'PixEcom — The Sellpage Builder That Tracks Ad Performance',
    description:
      'Build high-converting sellpages, track every Facebook ad click to purchase, and optimize with real-time analytics.',
    siteName: 'PixEcom',
    type: 'website',
  },
};

/**
 * Public layout — no sidebar, no auth guard.
 * Used for the marketing landing page and any future public pages.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
