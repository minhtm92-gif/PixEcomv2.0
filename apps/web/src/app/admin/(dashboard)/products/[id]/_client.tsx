'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard } from '@/components/KpiCard';
import { moneyWhole, num, pct, fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  MOCK_ADMIN_PRODUCTS,
  MOCK_PRODUCT_VARIANTS,
  MOCK_PRODUCT_REVIEWS,
  MOCK_PRODUCT_SELLPAGES,
  type MockProductVariant,
  type MockProductReview,
} from '@/mock/admin';

const TABS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Variants', value: 'variants' },
  { label: 'Sellpages', value: 'sellpages' },
  { label: 'Reviews', value: 'reviews' },
  { label: 'Stats', value: 'stats' },
];

export default function ProductDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState('overview');

  const product = MOCK_ADMIN_PRODUCTS.find((p) => p.id === id) ?? MOCK_ADMIN_PRODUCTS[0];

  if (!product) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/admin/products')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} /> Products
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          Product not found
        </div>
      </div>
    );
  }

  const margin = product.price - product.costPrice;
  const avgOrderValue = product.orders > 0 ? product.revenue / product.orders : 0;

  /* ── Variant columns ── */
  const variantColumns: Column<MockProductVariant>[] = [
    {
      key: 'image',
      label: '',
      render: (r) =>
        r.image ? (
          <img src={r.image} alt={r.name} className="w-8 h-8 rounded object-cover" />
        ) : (
          <div className="w-8 h-8 bg-muted rounded border border-border" />
        ),
    },
    {
      key: 'name',
      label: 'Variant',
      render: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'properties',
      label: 'Properties',
      render: (r) => <span className="text-xs text-muted-foreground">{r.properties}</span>,
    },
    {
      key: 'price',
      label: 'Price',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{moneyWhole(r.price)}</span>,
    },
    {
      key: 'compare',
      label: 'Compare',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm text-muted-foreground">{moneyWhole(r.compareAtPrice)}</span>,
    },
    {
      key: 'cost',
      label: 'Cost',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{moneyWhole(r.costPrice)}</span>,
    },
    {
      key: 'fulfillment',
      label: 'Fulfillment',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{moneyWhole(r.fulfillmentCost)}</span>,
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>,
    },
    {
      key: 'stock',
      label: 'Stock',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{num(r.stock)}</span>,
    },
  ];

  /* ── Sellpage columns ── */
  const sellpageColumns: Column<(typeof MOCK_PRODUCT_SELLPAGES)[0]>[] = [
    {
      key: 'slug',
      label: 'Slug',
      render: (r) => <span className="font-mono text-sm text-foreground">{r.slug}</span>,
    },
    {
      key: 'seller',
      label: 'Seller',
      render: (r) => <span className="text-sm text-foreground">{r.sellerName}</span>,
    },
    {
      key: 'domain',
      label: 'Domain',
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.domain}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'views',
      label: 'Views',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{num(r.views)}</span>,
    },
    {
      key: 'orders',
      label: 'Orders',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{num(r.orders)}</span>,
    },
    {
      key: 'cr',
      label: 'CR%',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{pct(r.cr)}</span>,
    },
  ];

  /* ── Review columns ── */
  const reviewColumns: Column<MockProductReview>[] = [
    {
      key: 'author',
      label: 'Author',
      render: (r) => <span className="text-sm font-medium text-foreground">{r.author}</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (r) => (
        <span className="text-amber-400 text-sm">
          {'★'.repeat(r.rating)}
          <span className="text-muted-foreground">{'★'.repeat(5 - r.rating)}</span>
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (r) => <span className="text-sm text-foreground">{r.title}</span>,
    },
    {
      key: 'verified',
      label: 'Verified',
      render: (r) =>
        r.verified ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
            Verified
          </span>
        ) : (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400">
            Unverified
          </span>
        ),
    },
    {
      key: 'images',
      label: 'Images',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{r.images.length}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <button
        onClick={() => router.push('/admin/products')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Products
      </button>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Package size={20} className="text-amber-400" />
          {product.name}
        </h1>
        <StatusBadge status={product.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-6 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Info */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Product Info</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Name</label>
                <p className="text-sm text-foreground">{product.name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Product Code</label>
                <p className="text-sm text-foreground font-mono">{product.productCode}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">SKU</label>
                <p className="text-sm text-foreground font-mono">{product.sku}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <StatusBadge status={product.status} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Description</label>
                <p className="text-sm text-foreground">{product.description}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tags</label>
                <div className="flex gap-2 flex-wrap">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-muted rounded-full px-3 py-1 text-xs text-foreground font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Created</label>
                <p className="text-sm text-foreground">{fmtDate(product.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Pricing</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Price</label>
                <p className="text-sm font-mono text-foreground">{moneyWhole(product.price)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Compare At</label>
                <p className="text-sm font-mono text-muted-foreground line-through">
                  {moneyWhole(product.compareAtPrice)}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Cost Price</label>
                <p className="text-sm font-mono text-foreground">{moneyWhole(product.costPrice)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Margin</label>
                <p className="text-sm font-mono text-green-400">{moneyWhole(margin)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">ROAS</label>
                <p
                  className={cn(
                    'text-sm font-mono font-bold',
                    product.roas >= 3
                      ? 'text-green-400'
                      : product.roas >= 2
                        ? 'text-amber-400'
                        : 'text-red-400',
                  )}
                >
                  {product.roas.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Variants */}
      {tab === 'variants' && (
        <DataTable
          columns={variantColumns}
          data={MOCK_PRODUCT_VARIANTS}
          loading={false}
          emptyMessage="No variants."
          rowKey={(r) => r.id}
        />
      )}

      {/* Tab: Sellpages */}
      {tab === 'sellpages' && (
        <DataTable
          columns={sellpageColumns}
          data={MOCK_PRODUCT_SELLPAGES}
          loading={false}
          emptyMessage="No sellpages."
          rowKey={(r) => r.id}
        />
      )}

      {/* Tab: Reviews */}
      {tab === 'reviews' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Reviews ({MOCK_PRODUCT_REVIEWS.length})
            </h3>
            <button
              disabled
              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium opacity-60 cursor-default"
            >
              Add Review
            </button>
          </div>
          <DataTable
            columns={reviewColumns}
            data={MOCK_PRODUCT_REVIEWS}
            loading={false}
            emptyMessage="No reviews."
            rowKey={(r) => r.id}
          />
        </div>
      )}

      {/* Tab: Stats */}
      {tab === 'stats' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total Revenue"
            value={moneyWhole(product.revenue)}
          />
          <KpiCard
            label="Total Orders"
            value={num(product.orders)}
          />
          <KpiCard label="ROAS" value={product.roas.toFixed(2)} />
          <KpiCard
            label="Avg Order Value"
            value={moneyWhole(avgOrderValue)}
          />
        </div>
      )}
    </div>
  );
}
