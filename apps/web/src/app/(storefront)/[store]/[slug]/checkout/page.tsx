import { Suspense } from 'react';
import type { Metadata } from 'next';
import CheckoutPage from './_client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function fetchSellpageData(store: string, slug: string) {
  try {
    const res = await fetch(`${API}/storefront/${store}/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildMetaPixelScript(pixelId: string): string {
  return `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`;
}

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
    const data = await fetchSellpageData(params.store, params.slug);
    if (!data) return { title: 'Checkout' };

    const productName = data.product?.name ?? 'your order';
    const storeName = data.store?.name ?? 'Store';

    return {
      title: `Checkout — ${productName} | ${storeName}`,
      description: `Complete your purchase of ${productName}. Secure payment via Stripe or PayPal.`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: 'Checkout' };
  }
}

export default async function Page({
  params,
}: {
  params: { store: string; slug: string };
}) {
  const data = await fetchSellpageData(params.store, params.slug);
  const pixelId = data?.sellpage?.headerConfig?.pixelId as string | undefined;

  return (
    <>
      {pixelId && (
        <>
          <script dangerouslySetInnerHTML={{ __html: buildMetaPixelScript(pixelId) }} />
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
      <Suspense>
        <CheckoutPage />
      </Suspense>
    </>
  );
}
