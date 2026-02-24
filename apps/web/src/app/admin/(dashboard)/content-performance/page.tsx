'use client';

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num, pct } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useAdminApi } from '@/hooks/useAdminApi';
import {
  CONTENT_PERFORMANCE_SELLPAGES,
  CONTENT_PERFORMANCE_CREATIVES,
  type MockContentPerformanceCreative,
} from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response types ──────────────────────────────────────────────────────

interface ContentPerfSellpage {
  sellpage: {
    id: string;
    slug: string;
    titleOverride: string | null;
    seller: { id: string; name: string };
    product: { id: string; name: string };
  } | null;
  stats: {
    revenue: number | null;
    ordersCount: number | null;
    adSpend: number | null;
    contentViews: number | null;
    purchases: number | null;
  };
}

interface ContentPerfResponse {
  topSellpages: ContentPerfSellpage[];
  creativeCount: number;
  activeCampaigns: number;
}

// Unified row type for sellpage table
interface SellpageRow {
  id: string;
  name: string;
  slug: string;
  product: string;
  status: string;
  views: number;
  orders: number;
  cr: number;
  revenue: number;
}

export default function ContentPerformancePage() {
  const { data: apiData, loading, error } = useAdminApi<ContentPerfResponse>(
    IS_PREVIEW ? null : '/admin/content-performance',
  );

  // Resolve data
  const sellpageRows: SellpageRow[] = useMemo(() => {
    if (IS_PREVIEW) {
      return CONTENT_PERFORMANCE_SELLPAGES.map((sp) => ({
        id: sp.id,
        name: sp.name,
        slug: sp.slug,
        product: sp.product,
        status: sp.status,
        views: sp.views,
        orders: sp.orders,
        cr: sp.cr,
        revenue: sp.revenue,
      }));
    }
    if (!apiData?.topSellpages) return [];
    return apiData.topSellpages.map((item, i) => {
      const views = Number(item.stats.contentViews ?? 0);
      const orders = Number(item.stats.ordersCount ?? 0);
      const purchases = Number(item.stats.purchases ?? 0);
      const revenue = Number(item.stats.revenue ?? 0);
      const cr = views > 0 ? (purchases / views) * 100 : 0;
      return {
        id: item.sellpage?.id ?? `sp-${i}`,
        name: item.sellpage?.titleOverride ?? item.sellpage?.slug ?? 'Unknown',
        slug: item.sellpage?.slug ?? '',
        product: item.sellpage?.product?.name ?? '',
        status: 'PUBLISHED',
        views,
        orders,
        cr,
        revenue,
      };
    });
  }, [apiData]);

  const creativeRows = IS_PREVIEW ? CONTENT_PERFORMANCE_CREATIVES : [];

  // KPI data
  const totalSellpages = IS_PREVIEW
    ? CONTENT_PERFORMANCE_SELLPAGES.length
    : apiData?.topSellpages?.length ?? 0;
  const publishedSellpages = IS_PREVIEW
    ? CONTENT_PERFORMANCE_SELLPAGES.filter((sp) => sp.status === 'PUBLISHED').length
    : sellpageRows.length;
  const totalCreatives = IS_PREVIEW
    ? CONTENT_PERFORMANCE_CREATIVES.length
    : apiData?.creativeCount ?? 0;
  const activeCreatives = IS_PREVIEW
    ? CONTENT_PERFORMANCE_CREATIVES.filter((c) => c.status === 'READY').length
    : apiData?.activeCampaigns ?? 0;

  if (!IS_PREVIEW && loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading content performance...</p>
        </div>
      </div>
    );
  }

  if (!IS_PREVIEW && error) {
    return (
      <PageShell
        icon={<TrendingUp size={20} className="text-amber-400" />}
        title="Content Performance"
        subtitle="Performance metrics for content you created"
      >
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error}
        </div>
      </PageShell>
    );
  }

  const sellpageColumns: Column<SellpageRow>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'slug',
      label: 'Slug',
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.slug}</span>,
    },
    {
      key: 'product',
      label: 'Product',
      render: (r) => <span className="text-sm text-foreground">{r.product}</span>,
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
    {
      key: 'revenue',
      label: 'Revenue',
      className: 'text-right',
      render: (r) => (
        <span className={cn('font-mono text-sm', r.revenue > 0 ? 'text-green-400' : 'text-foreground')}>
          {moneyWhole(r.revenue)}
        </span>
      ),
    },
  ];

  const creativeColumns: Column<MockContentPerformanceCreative>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400">
          {r.type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'product',
      label: 'Product',
      render: (r) => <span className="text-sm text-foreground">{r.product}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'spend',
      label: 'Spend',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{moneyWhole(r.spend)}</span>,
    },
    {
      key: 'clicks',
      label: 'Clicks',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{num(r.clicks)}</span>,
    },
    {
      key: 'ctr',
      label: 'CTR%',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm">{pct(r.ctr)}</span>,
    },
    {
      key: 'roas',
      label: 'ROAS',
      className: 'text-right',
      render: (r) => (
        <span
          className={cn(
            'font-mono text-sm font-bold',
            r.roas >= 3
              ? 'text-green-400'
              : r.roas >= 2
                ? 'text-amber-400'
                : 'text-red-400',
          )}
        >
          {r.roas.toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <PageShell
      icon={<TrendingUp size={20} className="text-amber-400" />}
      title="Content Performance"
      subtitle="Performance metrics for content you created"
    >
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Sellpages" value={num(totalSellpages)} />
        <KpiCard label="Published" value={num(publishedSellpages)} />
        <KpiCard label="Total Creatives" value={num(totalCreatives)} />
        <KpiCard label="Active Campaigns" value={num(activeCreatives)} />
      </div>

      {/* Section 1: Sellpage Performance */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">Sellpage Performance</h3>
        <DataTable
          columns={sellpageColumns}
          data={sellpageRows}
          loading={false}
          emptyMessage="No sellpage data."
          rowKey={(r) => r.id}
        />
      </div>

      {/* Section 2: Creative Performance (preview only for now) */}
      {creativeRows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">Creative Performance</h3>
          <DataTable
            columns={creativeColumns}
            data={creativeRows}
            loading={false}
            emptyMessage="No creative data."
            rowKey={(r) => r.id}
          />
        </div>
      )}
    </PageShell>
  );
}
