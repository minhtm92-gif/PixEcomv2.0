import { Suspense } from 'react';
import type { Metadata } from 'next';
import CheckoutPage from './_client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function generateStaticParams() {
  const slugs = ['lynsie-charm-bracelet', 'crystal-drop-earrings', 'golden-layered-necklace', 'pearl-charm-set'];
  return slugs.map((slug) => ({ store: 'demo-store', slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { store: string; slug: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(`${API}/storefront/${params.store}/${params.slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Checkout' };
    const data = await res.json();

    const productName = data.product?.name ?? 'your order';
    const storeName = data.store?.name ?? 'Store';

    return {
      title: `Checkout — ${productName} | ${storeName}`,
      description: `Complete your purchase of ${productName}. Secure payment via Stripe or PayPal.`,
      robots: { index: false, follow: false }, // Don't index checkout pages
    };
  } catch {
    return { title: 'Checkout' };
  }
}

export default function Page() {
  return (
    <Suspense>
      <CheckoutPage />
    </Suspense>
  );
}
