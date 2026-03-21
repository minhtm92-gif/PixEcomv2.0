'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { STORE_CONFIG } from '@/mock/storefront';
import { storeHref } from '@/lib/storefrontLinks';
import { fetchLegalPages, type LegalPageDoc } from '@/lib/storefrontApi';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

/** Slug-to-mock-key mapping (fallback when API has no content) */
const SLUG_TO_MOCK_KEY: Record<string, keyof typeof STORE_CONFIG.policies> = {
  shipping: 'shipping',
  returns: 'returns',
  privacy: 'privacy',
  terms: 'terms',
  'seller-agreement': 'sellerAgreement',
};

const PAGE_EMOJI: Record<string, string> = {
  shipping: '🚚',
  returns: '↩️',
  privacy: '🔒',
  terms: '📄',
  'seller-agreement': '📋',
};

const FALLBACK_TITLES: Record<string, string> = {
  shipping: 'Shipping Policy',
  returns: 'Returns & Exchanges',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  'seller-agreement': 'Seller Agreement',
};

/** Render markdown-ish text (bold headers and inline **bold**) */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((para, i) => {
        if (para.startsWith('**') && para.endsWith('**')) {
          return (
            <h3 key={i} className="text-base font-bold text-gray-900 mt-6 mb-2">
              {para.replace(/\*\*/g, '')}
            </h3>
          );
        }
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
    </>
  );
}

/** Render HTML content from admin editor */
function HtmlContent({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm max-w-none text-gray-700 leading-relaxed
        [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-6 [&_h1]:mb-3
        [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-5 [&_h2]:mb-2
        [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2
        [&_p]:mb-4 [&_p]:text-gray-600 [&_p]:leading-relaxed
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4
        [&_li]:mb-1 [&_li]:text-gray-600
        [&_a]:text-purple-600 [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function PolicyPage() {
  const params = useParams<{ store: string; page: string }>();
  const storeSlug = params?.store ?? 'demo-store';
  const pageSlug = params?.page ?? '';

  const [legalPages, setLegalPages] = useState<Record<string, LegalPageDoc> | null>(null);
  const [loading, setLoading] = useState(!IS_PREVIEW);

  useEffect(() => {
    if (IS_PREVIEW) return;
    let cancelled = false;
    fetchLegalPages()
      .then((data) => { if (!cancelled) setLegalPages(data); })
      .catch(() => { /* fall back to mock */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Determine content source: API first, then mock fallback
  const apiDoc = legalPages?.[pageSlug];
  const mockKey = SLUG_TO_MOCK_KEY[pageSlug];
  const hasMockContent = mockKey && STORE_CONFIG.policies[mockKey];

  const isKnownPage = !!apiDoc || !!mockKey;
  const title = apiDoc?.title || FALLBACK_TITLES[pageSlug] || pageSlug;
  const emoji = PAGE_EMOJI[pageSlug] || '📄';
  const lastUpdated = apiDoc?.lastUpdated || 'February 2026';

  // Build list of all page slugs for "Other policies" links
  const allSlugs = Object.keys(FALLBACK_TITLES);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={storeHref(storeSlug)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Shop
          </Link>
          <Link href={storeHref(storeSlug)} className="font-bold text-lg text-gray-900">
            {STORE_CONFIG.name}
          </Link>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : isKnownPage ? (
          <>
            {/* Title */}
            <div className="mb-8">
              <span className="text-3xl mr-2">{emoji}</span>
              <h1 className="text-3xl font-bold text-gray-900 mt-3">{title}</h1>
              <p className="text-sm text-gray-400 mt-2">
                Last updated: {lastUpdated} · {STORE_CONFIG.name}
              </p>
            </div>

            {/* Content: prefer API content, fall back to mock */}
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              {apiDoc?.content ? (
                <HtmlContent html={apiDoc.content} />
              ) : hasMockContent ? (
                <RichText text={STORE_CONFIG.policies[mockKey]} />
              ) : (
                <p className="text-gray-400 italic">
                  This policy page has not been configured yet. Please update it from the admin dashboard.
                </p>
              )}
            </div>

            {/* Footer links */}
            <div className="mt-12 pt-8 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">Other policies</p>
              <div className="flex flex-wrap gap-3">
                {allSlugs
                  .filter((slug) => slug !== pageSlug)
                  .map((slug) => (
                    <Link
                      key={slug}
                      href={storeHref(storeSlug, `/pages/${slug}`)}
                      className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
                    >
                      {PAGE_EMOJI[slug] || '📄'} {FALLBACK_TITLES[slug]}
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
              <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">{pageSlug}</code>{' '}
              does not exist.
            </p>
            <Link
              href={storeHref(storeSlug)}
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
          <Link href={storeHref(storeSlug)} className="text-purple-500 hover:underline">
            Return to Shop →
          </Link>
        </div>
      </footer>
    </div>
  );
}
