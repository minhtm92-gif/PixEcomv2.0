import SellpagePage from './_client';

export function generateStaticParams() {
  const slugs = ['lynsie-charm-bracelet', 'crystal-drop-earrings', 'golden-layered-necklace', 'pearl-charm-set'];
  return slugs.map((slug) => ({ store: 'demo-store', slug }));
}

export default function Page() {
  return <SellpagePage />;
}
