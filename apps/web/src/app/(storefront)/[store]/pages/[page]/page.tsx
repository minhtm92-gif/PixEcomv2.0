'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { STORE_CONFIG } from '@/mock/storefront';

const PAGE_CONFIG: Record<
  string,
  { title: string; contentKey: keyof typeof STORE_CONFIG.policies; emoji: string }
> = {
  shipping: { title: 'Shipping Policy', contentKey: 'shipping', emoji: '🚚' },
  returns: { title: 'Returns & Exchanges', contentKey: 'returns', emoji: '↩️' },
  privacy: { title: 'Privacy Policy', contentKey: 'privacy', emoji: '🔒' },
  terms: { title: 'Terms of Service', contentKey: 'terms', emoji: '📄' },
};

export default function PolicyPage() {
  const params = useParams<{ store: string; page: string }>();
  const storeSlug = params?.store ?? 'demo-store';
  const pageSlug = params?.page ?? '';

  const config = PAGE_CONFIG[pageSlug];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={`/${storeSlug}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Shop
          </Link>
          <Link href={`/${storeSlug}`} className="font-bold text-lg text-gray-900">
            {STORE_CONFIG.name}
          </Link>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {config ? (
          <>
            {/* Title */}
            <div className="mb-8">
              <span className="text-3xl mr-2">{config.emoji}</span>
              <h1 className="text-3xl font-bold text-gray-900 mt-3">{config.title}</h1>
              <p className="text-sm text-gray-400 mt-2">
                Last updated: February 2026 · {STORE_CONFIG.name}
              </p>
            </div>

            {/* Content */}
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              {STORE_CONFIG.policies[config.contentKey]
                .split('\n\n')
                .map((para, i) => {
                  // Simple markdown-ish rendering
                  if (para.startsWith('**') && para.endsWith('**')) {
                    return (
                      <h3
                        key={i}
                        className="text-base font-bold text-gray-900 mt-6 mb-2"
                      >
                        {para.replace(/\*\*/g, '')}
                      </h3>
                    );
                  }
                  // Replace **text** inline bold
                  const parts = para.split(/(\*\*[^*]+\*\*)/g);
                  return (
                    <p key={i} className="mb-4 text-gray-600 leading-relaxed">
                      {parts.map((part, j) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return (
                            <strong key={j} className="text-gray-900 font-semibold">
                              {part.slice(2, -2)}
                            </strong>
                          );
                        }
                        return part;
                      })}
                    </p>
                  );
                })}
            </div>

            {/* Footer links */}
            <div className="mt-12 pt-8 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Other policies
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(PAGE_CONFIG)
                  .filter(([slug]) => slug !== pageSlug)
                  .map(([slug, cfg]) => (
                    <Link
                      key={slug}
                      href={`/${storeSlug}/pages/${slug}`}
                      className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
                    >
                      {cfg.emoji} {cfg.title}
                    </Link>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</p>
            <p className="text-gray-500 mb-6">
              The page{' '}
              <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">
                {pageSlug}
              </code>{' '}
              does not exist.
            </p>
            <Link
              href={`/${storeSlug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors"
            >
              <ArrowLeft size={15} /> Back to Shop
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 mt-16 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} {STORE_CONFIG.name}. All rights reserved.</span>
          <Link href={`/${storeSlug}`} className="text-purple-500 hover:underline">
            Return to Shop →
          </Link>
        </div>
      </footer>
    </div>
  );
}
