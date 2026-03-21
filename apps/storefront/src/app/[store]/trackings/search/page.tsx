import type { Metadata } from 'next';
import TrackingSearchPage from './_client';

export function generateStaticParams() {
  return [{ store: 'demo-store' }, { store: 'pixelxlab-store-rs59b8' }];
}

export const metadata: Metadata = {
  title: 'Track Your Order',
  description: 'Enter your order number and email to track your delivery status.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TrackingSearchPage />;
}
