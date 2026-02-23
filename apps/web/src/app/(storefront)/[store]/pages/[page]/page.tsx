import PolicyPage from './_client';

export function generateStaticParams() {
  const pages = ['shipping', 'returns', 'privacy', 'terms'];
  return pages.map((page) => ({ store: 'demo-store', page }));
}

export default function Page() {
  return <PolicyPage />;
}
