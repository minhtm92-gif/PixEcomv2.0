import OrderDetailPage from './_client';

export function generateStaticParams() {
  return [{ id: 'preview-1' }];
}

export default function Page() {
  return <OrderDetailPage />;
}
