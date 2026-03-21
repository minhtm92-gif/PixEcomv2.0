import ProductDetailClient from './_client';

export function generateStaticParams() {
  return [{ id: 'preview-1' }];
}

export default function Page() {
  return <ProductDetailClient />;
}
