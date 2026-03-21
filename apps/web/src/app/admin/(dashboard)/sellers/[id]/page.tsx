import SellerDetailPage from './_client';

export function generateStaticParams() {
  return [
    { id: 'sel_01' }, { id: 'sel_02' }, { id: 'sel_03' },
    { id: 'sel_04' }, { id: 'sel_05' }, { id: 'sel_06' },
  ];
}

export default function Page() {
  return <SellerDetailPage />;
}
