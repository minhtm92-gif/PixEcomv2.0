import type { MetadataRoute } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

interface SitemapSeller {
  slug: string;
  updatedAt: string;
  sellpages: Array<{
    slug: string;
    updatedAt: string;
  }>;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  entries.push({
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  });

  // Dynamic store + sellpage URLs from API
  try {
    const res = await fetch(`${API}/storefront/sitemap-data`, {
      next: { revalidate: 3600 }, // re-fetch every hour
    });

    if (res.ok) {
      const data: { sellers: SitemapSeller[] } = await res.json();

      for (const seller of data.sellers) {
        // Store homepage
        entries.push({
          url: `${SITE_URL}/${seller.slug}`,
          lastModified: new Date(seller.updatedAt),
          changeFrequency: 'daily',
          priority: 0.8,
        });

        // Individual sellpages (product pages)
        for (const sp of seller.sellpages) {
          entries.push({
            url: `${SITE_URL}/${seller.slug}/${sp.slug}`,
            lastModified: new Date(sp.updatedAt),
            changeFrequency: 'weekly',
            priority: 0.9,
          });
        }
      }
    }
  } catch {
    // Sitemap generation should never crash — return what we have
  }

  return entries;
}
