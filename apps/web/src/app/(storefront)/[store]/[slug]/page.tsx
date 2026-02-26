import type { Metadata } from 'next';
import SellpagePage from './_client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function buildJsonLd(data: any, store: string, slug: string): object | null {
  const product = data?.product;
  const sellpage = data?.sellpage;
  const storeName = data?.store?.name;
  if (!product) return null;

  const price = product.basePrice;
  const currency = product.currency ?? 'USD';
  const images = (product.images ?? []) as string[];
  const hasStock = (product.variants ?? []).some(
    (v: any) => v.isActive && v.stockQuantity > 0,
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: sellpage?.title ?? product.name,
    description:
      sellpage?.seoDescription ??
      sellpage?.description ??
      product.description ??
      '',
    url: `${SITE_URL}/${store}/${slug}`,
    ...(images.length > 0 ? { image: images } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    brand: {
      '@type': 'Brand',
      name: storeName ?? store,
    },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/${store}/${slug}`,
      priceCurrency: currency,
      price: price.toFixed(2),
      availability: hasStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      ...(product.compareAtPrice
        ? {
            priceValidUntil: new Date(
              Date.now() + 30 * 86400000,
            )
              .toISOString()
              .slice(0, 10),
          }
        : {}),
      seller: {
        '@type': 'Organization',
        name: storeName ?? store,
      },
    },
    ...(product.rating > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewCount || 1,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

// ─── Static params ──────────────────────────────────────────────────────────

export function generateStaticParams() {
  const slugs = ['lynsie-charm-bracelet', 'crystal-drop-earrings', 'golden-layered-necklace', 'pearl-charm-set'];
  return slugs.map((slug) => ({ store: 'demo-store', slug }));
}

// ─── Metadata (SEO) ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { store: string; slug: string };
}): Promise<Metadata> {
  const data = await fetchSellpageData(params.store, params.slug);
  if (!data) return { title: 'Product' };

  const title = data.sellpage?.seoTitle ?? data.sellpage?.title ?? data.product?.name ?? 'Product';
  const description =
    data.sellpage?.seoDescription ??
    data.sellpage?.description ??
    `Shop ${data.product?.name} at great prices.`;
  const ogImage = data.sellpage?.seoOgImage ?? data.product?.images?.[0] ?? null;
  const price = data.product?.basePrice;
  const currency = data.product?.currency ?? 'USD';
  const faviconUrl = data.store?.faviconUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    other: {
      // Product structured hints for social sharing
      ...(price ? { 'product:price:amount': String(price) } : {}),
      ...(currency ? { 'product:price:currency': currency } : {}),
    },
    ...(faviconUrl ? { icons: { icon: faviconUrl } } : {}),
  };
}

// ─── Page component (server) ────────────────────────────────────────────────

export default async function Page({
  params,
}: {
  params: { store: string; slug: string };
}) {
  const data = await fetchSellpageData(params.store, params.slug);
  const jsonLd = data ? buildJsonLd(data, params.store, params.slug) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SellpagePage initialData={data} />
    </>
  );
}
