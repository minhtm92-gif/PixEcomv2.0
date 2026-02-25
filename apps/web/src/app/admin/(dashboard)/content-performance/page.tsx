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
  seller: string;
  status: string;
  views: number;
  orders: number;
  cr: number;
  revenue: number;
}

export default function ContentPerformancePage() {
  const { data: apiData, loading, error } = useAdminApi<ContentPerfResponse>(
    '/admin/content-performance',
  );

  // Resolve data
  const sellpageRows: SellpageRow[] = useMemo(() => {
    if (!apiData?.topSellpages) return [];
    return apiData.topSellpages.map((item, i) => {
      const views = Number(item.stats.contentViews ?? 0);
      const purchases = Number(item.stats.purchases ?? 0);
      const orders = Number(item.stats.ordersCount ?? 0);
      const revenue = Number(item.stats.revenue ?? 0);
      const cr = views > 0 ? (purchases / views) * 100 : 0;
      return {
        id: item.sellpage?.id ?? `sp-${i}`,
        name: item.sellpage?.titleOverride ?? item.sellpage?.slug ?? 'Unknown',
        slug: item.sellpage?.slug ?? '',
        product: item.sellpage?.product?.name ?? '',
        seller: item.sellpage?.seller?.name ?? '',
        status: 'PUBLISHED',
        views,
        orders,
        cr,
        revenue,
      };
    });
  }, [apiData]);

  // KPI data
  const totalSellpages = apiData?.topSellpages?.length ?? 0;
  const publishedSellpages = sellpageRows.length;
  const totalCreatives = apiData?.creativeCount ?? 0;
  const activeCreatives = apiData?.activeCampaigns ?? 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading content performance...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <PageShell
        icon={<TrendingUp size={20} className="text-amber-400" />}
        title="Content Performance"
        subtitle="Performance metrics for sellpages and creatives"
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
      key: 'seller',
      label: 'Seller',
      render: (r) => <span className="text-sm text-muted-foreground">{r.seller}</span>,
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

  return (
    <PageShell
      icon={<TrendingUp size={20} className="text-amber-400" />}
      title="Content Performance"
      subtitle="Performance metrics for sellpages and creatives"
    >
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Sellpages" value={num(totalSellpages)} />
        <KpiCard label="Published" value={num(publishedSellpages)} />
        <KpiCard label="Total Creatives" value={num(totalCreatives)} />
        <KpiCard label="Active Campaigns" value={num(activeCreatives)} />
      </div>

      {/* Sellpage Performance */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Sellpage Performance</h3>
        <DataTable
          columns={sellpageColumns}
          data={sellpageRows}
          loading={false}
          emptyMessage="No sellpage data yet."
          rowKey={(r) => r.id}
        />
      </div>
    </PageShell>
  );
}
