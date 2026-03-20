import PolicyPage from './_client';

export function generateStaticParams() {
  const stores = ['demo-store', 'pixelxlab-store-rs59b8'];
  const pages = ['shipping', 'returns', 'privacy', 'terms', 'seller-agreement'];
  return stores.flatMap((store) => pages.map((page) => ({ store, page })));
}

export default function Page() {
  return <PolicyPage />;
}
