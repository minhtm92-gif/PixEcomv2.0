'use client';

import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { moneyWhole, num, pct } from '@/lib/format';
import { useAdminApi } from '@/hooks/useAdminApi';
import { ANALYTICS_DATA } from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response types ──────────────────────────────────────────────────────

interface DateRow {
  date: string;
  revenue: number;
  orders: number;
  spend: number;
  productCost: number;
  paymentFee: number;
  profit: number;
  roas: number;
}

interface SellerRow {
  name: string;
  revenue: number;
  orders: number;
  spend: number;
  roas: number;
}

interface ProductRow {
  name: string;
  orders: number;
  revenue: number;
  cr: number;
}

interface DomainRow {
  domain: string;
  revenue: number;
  orders: number;
  cr: number;
}

interface AnalyticsResponse {
  byDate: DateRow[];
  bySeller: SellerRow[];
  byProduct: ProductRow[];
  byDomain: DomainRow[];
}

const TABS = ['Overview', 'By Seller', 'By Product', 'By Domain'];

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState('Overview');

  const { data: apiData, loading, error } = useAdminApi<AnalyticsResponse>(
    IS_PREVIEW ? null : '/admin/analytics',
  );

  // Resolve data
  const analyticsData = IS_PREVIEW ? ANALYTICS_DATA : apiData;

  if (!IS_PREVIEW && loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!IS_PREVIEW && error) {
    return (
      <PageShell
        icon={<BarChart3 size={20} className="text-amber-400" />}
        title="Analytics"
        subtitle="Platform-wide performance — last 7 days"
      >
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error}
        </div>
      </PageShell>
    );
  }

  if (!analyticsData) return null;

  const byDate = analyticsData.byDate ?? [];
  const bySeller = analyticsData.bySeller ?? [];
  const byProduct = analyticsData.byProduct ?? [];
  const byDomain = analyticsData.byDomain ?? [];

  const totals = byDate.reduce(
    (acc, d) => ({
      revenue: acc.revenue + d.revenue,
      orders: acc.orders + d.orders,
      spend: acc.spend + d.spend,
      productCost: acc.productCost + d.productCost,
      paymentFee: acc.paymentFee + d.paymentFee,
      profit: acc.profit + d.profit,
    }),
    { revenue: 0, orders: 0, spend: 0, productCost: 0, paymentFee: 0, profit: 0 },
  );
  const maxRevenue = Math.max(...byDate.map((d) => d.revenue), 1);

  return (
    <PageShell
      icon={<BarChart3 size={20} className="text-amber-400" />}
      title="Analytics"
      subtitle="Platform-wide performance — last 7 days"
    >
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard label="Total Revenue" value={moneyWhole(totals.revenue)} />
        <KpiCard label="Total Orders" value={num(totals.orders)} />
        <KpiCard label="Total Spend" value={moneyWhole(totals.spend)} />
        <KpiCard label="Product Cost" value={moneyWhole(totals.productCost)} />
        <KpiCard label="Payment Fee" value={moneyWhole(totals.paymentFee)} />
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Profit</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{moneyWhole(totals.profit)}</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Revenue — Last 7 Days</h2>
        <div className="flex items-end gap-2 h-36">
          {byDate.map((d) => {
            const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
            const dateLabel = d.date.slice(5).replace('-', '/');
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-amber-500/70 hover:bg-amber-500 rounded-t transition-colors"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    title={`${moneyWhole(d.revenue)} — ${d.orders} orders — ROAS ${d.roas.toFixed(2)}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{dateLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-muted/50 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Orders</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Spend</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Product Cost</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Payment Fee</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Profit</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {byDate.map((d) => (
                <tr
                  key={d.date}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{d.date}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground text-right">
                    {moneyWhole(d.revenue)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground text-right">
                    {num(d.orders)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground text-right">
                    {moneyWhole(d.spend)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground text-right">
                    {moneyWhole(d.productCost)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground text-right">
                    {moneyWhole(d.paymentFee)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-right text-green-400">
                    {moneyWhole(d.profit)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-right">
                    <span
                      className={
                        d.roas >= 3
                          ? 'text-green-400'
                          : d.roas >= 2
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    >
                      {d.roas.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'By Seller' && (
        <DataTable
          columns={
            [
              {
                key: 'name',
                label: 'Seller',
                render: (r: SellerRow) => (
                  <span className="text-sm font-medium text-foreground">{r.name}</span>
                ),
              },
              {
                key: 'revenue',
                label: 'Revenue',
                className: 'text-right',
                render: (r: SellerRow) => (
                  <span className="font-mono text-sm text-foreground">{moneyWhole(r.revenue)}</span>
                ),
              },
              {
                key: 'orders',
                label: 'Orders',
                className: 'text-right',
                render: (r: SellerRow) => (
                  <span className="font-mono text-sm text-foreground">{num(r.orders)}</span>
                ),
              },
              {
                key: 'spend',
                label: 'Spend',
                className: 'text-right',
                render: (r: SellerRow) => (
                  <span className="font-mono text-sm text-foreground">{moneyWhole(r.spend)}</span>
                ),
              },
              {
                key: 'roas',
                label: 'ROAS',
                className: 'text-right',
                render: (r: SellerRow) => (
                  <span
                    className={`font-mono text-sm ${r.roas >= 3 ? 'text-green-400' : r.roas >= 2 ? 'text-amber-400' : 'text-red-400'}`}
                  >
                    {r.roas.toFixed(2)}
                  </span>
                ),
              },
            ] as Column<SellerRow>[]
          }
          data={bySeller}
          loading={false}
          emptyMessage="No data."
          rowKey={(r) => r.name}
        />
      )}

      {tab === 'By Product' && (
        <DataTable
          columns={
            [
              {
                key: 'name',
                label: 'Product',
                render: (r: ProductRow) => (
                  <span className="text-sm font-medium text-foreground">{r.name}</span>
                ),
              },
              {
                key: 'revenue',
                label: 'Revenue',
                className: 'text-right',
                render: (r: ProductRow) => (
                  <span className="font-mono text-sm text-foreground">{moneyWhole(r.revenue)}</span>
                ),
              },
              {
                key: 'orders',
                label: 'Orders',
                className: 'text-right',
                render: (r: ProductRow) => (
                  <span className="font-mono text-sm text-foreground">{num(r.orders)}</span>
                ),
              },
              {
                key: 'cr',
                label: 'CR',
                className: 'text-right',
                render: (r: ProductRow) => (
                  <span className="font-mono text-sm text-foreground">{pct(r.cr)}</span>
                ),
              },
            ] as Column<ProductRow>[]
          }
          data={byProduct}
          loading={false}
          emptyMessage="No data."
          rowKey={(r) => r.name}
        />
      )}

      {tab === 'By Domain' && (
        <DataTable
          columns={
            [
              {
                key: 'domain',
                label: 'Domain',
                render: (r: DomainRow) => (
                  <span className="text-sm font-mono text-foreground">{r.domain}</span>
                ),
              },
              {
                key: 'revenue',
                label: 'Revenue',
                className: 'text-right',
                render: (r: DomainRow) => (
                  <span className="font-mono text-sm text-foreground">{moneyWhole(r.revenue)}</span>
                ),
              },
              {
                key: 'orders',
                label: 'Orders',
                className: 'text-right',
                render: (r: DomainRow) => (
                  <span className="font-mono text-sm text-foreground">{num(r.orders)}</span>
                ),
              },
              {
                key: 'cr',
                label: 'CR',
                className: 'text-right',
                render: (r: DomainRow) => (
                  <span className="font-mono text-sm text-foreground">{pct(r.cr)}</span>
                ),
              },
            ] as Column<DomainRow>[]
          }
          data={byDomain}
          loading={false}
          emptyMessage="No data."
          rowKey={(r) => r.domain}
        />
      )}
    </PageShell>
  );
}
