import StoreHomePage from './_client';

export function generateStaticParams() {
  return [{ store: 'demo-store' }];
}

export default function Page() {
  return <StoreHomePage />;
}
