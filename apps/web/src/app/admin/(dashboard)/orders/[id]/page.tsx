import AdminOrderDetailPage from './_client';

export function generateStaticParams() {
  return [
    { id: 'ord_01' }, { id: 'ord_02' }, { id: 'ord_03' }, { id: 'ord_04' },
    { id: 'ord_05' }, { id: 'ord_06' }, { id: 'ord_07' }, { id: 'ord_08' },
  ];
}

export default function Page() {
  return <AdminOrderDetailPage />;
}
