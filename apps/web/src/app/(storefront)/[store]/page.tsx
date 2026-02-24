import type { Metadata } from 'next';
import StoreHomePage from './_client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function generateStaticParams() {
  return [{ store: 'demo-store' }];
}

export async function generateMetadata({
  params,
}: {
  params: { store: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(`${API}/storefront/${params.store}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Store' };
    const data = await res.json();

    const storeName = data.store?.name ?? 'Store';
    return {
      title: `${storeName} — Shop Our Products`,
      description: `Browse premium products from ${storeName}. Free shipping on orders over $50.`,
      openGraph: {
        title: `${storeName} — Shop Our Products`,
        description: `Browse premium products from ${storeName}. Free shipping on orders over $50.`,
        type: 'website',
      },
    };
  } catch {
    return { title: 'Store' };
  }
}

export default function Page() {
  return <StoreHomePage />;
}
