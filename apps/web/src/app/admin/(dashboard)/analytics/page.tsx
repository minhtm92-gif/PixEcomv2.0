'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { moneyWhole, num, pct } from '@/lib/format';
import { ANALYTICS_DATA } from '@/mock/admin';

const TABS = ['Overview', 'By Seller', 'By Product', 'By Domain'];

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState('Overview');

  const totals = ANALYTICS_DATA.byDate.reduce(
    (acc, d) => ({
      revenue: acc.revenue + d.revenue,
      orders: acc.orders + d.orders,
      spend: acc.spend + d.spend,
    }),
    { revenue: 0, orders: 0, spend: 0 },
  );
  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const maxRevenue = Math.max(...ANALYTICS_DATA.byDate.map((d) => d.revenue));

  return (
    <PageShell
      icon={<BarChart3 size={20} className="text-amber-400" />}
      title="Analytics"
      subtitle="Platform-wide performance — last 7 days"
    >
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Revenue" value={moneyWhole(totals.revenue)} />
        <KpiCard label="Total Orders" value={num(totals.orders)} />
        <KpiCard label="Total Spend" value={moneyWhole(totals.spend)} />
        <KpiCard label="Avg ROAS" value={avgRoas.toFixed(2)} />
      </div>

      {/* Revenue chart */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Revenue — Last 7 Days</h2>
        <div className="flex items-end gap-2 h-36">
          {ANALYTICS_DATA.byDate.map((d) => {
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
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {ANALYTICS_DATA.byDate.map((d) => (
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
                render: (r) => (
                  <span className="text-sm font-medium text-foreground">{r.name}</span>
                ),
              },
              {
                key: 'revenue',
                label: 'Revenue',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{moneyWhole(r.revenue)}</span>
                ),
              },
              {
                key: 'orders',
                label: 'Orders',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{num(r.orders)}</span>
                ),
              },
              {
                key: 'spend',
                label: 'Spend',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{moneyWhole(r.spend)}</span>
                ),
              },
              {
                key: 'roas',
                label: 'ROAS',
                className: 'text-right',
                render: (r) => (
                  <span
                    className={`font-mono text-sm ${r.roas >= 3 ? 'text-green-400' : r.roas >= 2 ? 'text-amber-400' : 'text-red-400'}`}
                  >
                    {r.roas.toFixed(2)}
                  </span>
                ),
              },
            ] as Column<(typeof ANALYTICS_DATA.bySeller)[0]>[]
          }
          data={ANALYTICS_DATA.bySeller}
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
                render: (r) => (
                  <span className="text-sm font-medium text-foreground">{r.name}</span>
                ),
              },
              {
                key: 'revenue',
                label: 'Revenue',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{moneyWhole(r.revenue)}</span>
                ),
              },
              {
                key: 'orders',
                label: 'Orders',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{num(r.orders)}</span>
                ),
              },
              {
                key: 'cr',
                label: 'CR',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{pct(r.cr)}</span>
                ),
              },
            ] as Column<(typeof ANALYTICS_DATA.byProduct)[0]>[]
          }
          data={ANALYTICS_DATA.byProduct}
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
                render: (r) => (
                  <span className="text-sm font-mono text-foreground">{r.domain}</span>
                ),
              },
              {
                key: 'revenue',
                label: 'Revenue',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{moneyWhole(r.revenue)}</span>
                ),
              },
              {
                key: 'orders',
                label: 'Orders',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{num(r.orders)}</span>
                ),
              },
              {
                key: 'cr',
                label: 'CR',
                className: 'text-right',
                render: (r) => (
                  <span className="font-mono text-sm text-foreground">{pct(r.cr)}</span>
                ),
              },
            ] as Column<(typeof ANALYTICS_DATA.byDomain)[0]>[]
          }
          data={ANALYTICS_DATA.byDomain}
          loading={false}
          emptyMessage="No data."
          rowKey={(r) => r.domain}
        />
      )}
    </PageShell>
  );
}
