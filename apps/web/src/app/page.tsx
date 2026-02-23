import { redirect } from 'next/navigation';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

export default function Home() {
  if (IS_PREVIEW) {
    redirect('/preview');
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">PixEcom v2</h1>
        <p className="mt-2 text-gray-600">Seller Portal — Coming Soon</p>
      </div>
    </main>
  );
}
