'use client';

import { Shield, ClipboardList, Star } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num } from '@/lib/format';
import { DASHBOARD_KPIS, MOCK_ADMIN_ORDERS } from '@/mock/admin';

export default function AdminDashboardPage() {
  const kpis = DASHBOARD_KPIS;
  const recentOrders = MOCK_ADMIN_ORDERS.slice(0, 5);
  const maxRevenue = Math.max(...kpis.revenueByDay.map((d) => d.revenue));
  const todayRevenue = kpis.revenueByDay[kpis.revenueByDay.length - 1]?.revenue ?? 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield size={22} className="text-amber-400" />
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Platform overview and administration</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard label="Active Sellers" value={num(kpis.activeSellers)} />
        <KpiCard label="Pending Approval" value={num(kpis.pendingApprovals)} />
        <KpiCard label="Total Orders" value={num(kpis.totalOrders)} />
        <KpiCard label="Total Revenue" value={moneyWhole(kpis.totalRevenue)} />
        <KpiCard label="Avg ROAS" value={kpis.avgRoas.toFixed(2)} />
        <KpiCard label="Revenue Today" value={moneyWhole(todayRevenue)} />
      </div>

      {/* Revenue Chart */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Revenue — Last 7 Days</h2>
        <div className="flex items-end gap-2 h-32">
          {kpis.revenueByDay.map((d) => {
            const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
            const dateLabel = d.date.slice(5).replace('-', '/');
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-amber-500/70 hover:bg-amber-500 rounded-t transition-colors"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    title={`$${d.revenue.toLocaleString()} — ${d.orders} orders`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{dateLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Star size={14} className="text-amber-400" />
            Top Sellers
          </h2>
          <div className="space-y-3">
            {kpis.topSellers.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{num(s.orders)} orders</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-foreground">{moneyWhole(s.revenue)}</p>
                  <p className="text-xs text-muted-foreground">ROAS {s.roas.toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ClipboardList size={14} className="text-amber-400" />
            Recent Orders
          </h2>
          <div className="space-y-3">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium text-foreground">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground truncate">{o.sellerName}</p>
                </div>
                <StatusBadge status={o.status} />
                <span className="text-sm font-mono text-foreground flex-shrink-0">
                  {moneyWhole(o.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
