'use client';

import { useState, useMemo } from 'react';
import { ShoppingBag, Plus, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyDecimal, safeDecimal } from '@/lib/format';
import { useAdminApi } from '@/hooks/useAdminApi';
import { cn } from '@/lib/cn';

// ── API response types ──────────────────────────────────────────────────────

interface PricingRuleSummary {
  id: string;
  suggestedRetail: string | number;
  sellerTakePercent: string | number;
  sellerTakeFixed: string | number | null;
}

interface ProductApiRow {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  basePrice: string | number;
  compareAtPrice: string | number | null;
  costPrice: string | number | null;
  currency: string;
  sku: string | null;
  status: string;
  tags: string[];
  images: string[];
  pricingRules: PricingRuleSummary[];
  createdAt: string;
  updatedAt: string;
  _count: { variants: number; sellpages: number; orderItems: number };
}

interface ProductsResponse {
  data: ProductApiRow[];
  total: number;
  page: number;
  limit: number;
}

interface LabelItem {
  id: string;
  name: string;
  slug: string;
}

const ALL_STATUSES = ['All', 'ACTIVE', 'DRAFT', 'ARCHIVED'];

export default function AdminProductsPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState('All');
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState('All');

  // Build API path
  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (statusTab !== 'All') params.set('status', statusTab);
    if (search.trim()) params.set('search', search.trim());
    return `/admin/products?${params.toString()}`;
  }, [statusTab, search]);

  const { data: apiData, loading, error } = useAdminApi<ProductsResponse>(apiPath);
  const { data: labelsData } = useAdminApi<LabelItem[]>('/admin/products/labels');

  const products = apiData?.data ?? [];

  // Counts for status tabs
  const counts = useMemo(() => {
    return {
      All: products.length,
      ACTIVE: products.filter((p) => p.status === 'ACTIVE').length,
      DRAFT: products.filter((p) => p.status === 'DRAFT').length,
      ARCHIVED: products.filter((p) => p.status === 'ARCHIVED').length,
    };
  }, [products]);

  return (
    <PageShell
      icon={<ShoppingBag size={20} className="text-amber-400" />}
      title="Products"
      subtitle="All products across all sellers"
      actions={
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg text-sm transition-colors"
        >
          <Plus size={16} />
          Add Product
        </Link>
      }
    >
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                statusTab === s
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'All' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}{' '}
              <span className="ml-1 text-muted-foreground">{counts[s as keyof typeof counts]}</span>
            </button>
          ))}
        </div>

        {/* Label filter */}
        {labelsData && labelsData.length > 0 && (
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="All">All Labels</option>
            {labelsData.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors w-64"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card Grid */}
      {!loading && products.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No products found.
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const images = (product.images as string[]) ?? [];
            const firstImage = images[0];
            const rule = product.pricingRules?.[0];
            const suggestedRetail = rule ? safeDecimal(rule.suggestedRetail) : 0;
            const sellerTakePercent = rule ? safeDecimal(rule.sellerTakePercent) : 0;
            const youTake = suggestedRetail > 0 ? suggestedRetail * sellerTakePercent / 100 : 0;

            return (
              <div
                key={product.id}
                onClick={() => router.push(`/admin/products/${product.id}`)}
                className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-amber-500/50 hover:shadow-lg transition-all group"
              >
                {/* Image */}
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {firstImage ? (
                    <img
                      src={firstImage}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={48} className="text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <StatusBadge status={product.status} />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {product.productCode}
                  </p>

                  <div className="space-y-1 pt-1">
                    {suggestedRetail > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Suggested retail</span>
                        <span className="font-mono text-foreground font-medium">
                          {moneyDecimal(suggestedRetail)}
                        </span>
                      </div>
                    )}
                    {youTake > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">You take</span>
                        <span className="font-mono text-green-400 font-medium">
                          {moneyDecimal(youTake)} / order
                        </span>
                      </div>
                    )}
                    {suggestedRetail === 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Base price</span>
                        <span className="font-mono text-foreground font-medium">
                          {moneyDecimal(product.basePrice)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/products/${product.id}`);
                      }}
                      className="w-full text-center py-2 text-xs font-medium text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      + Create a sellpage
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
