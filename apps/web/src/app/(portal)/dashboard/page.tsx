'use client';

import {
  DollarSign,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  mockDashboardKpi,
  mockRevenueChart,
  mockTopSellpages,
  mockRecentOrders,
} from '@/mock/dashboard';
import { formatCurrency, formatCompact } from '@/lib/helpers';

export default function DashboardPage() {
  const kpi = mockDashboardKpi;

  return (
    <div className="container-fluid space-y-5">
      <PageHeader title="Dashboard" subtitle="Welcome back, Demo Seller" />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Revenue"
          value={formatCurrency(kpi.revenue)}
          change={kpi.revenueDelta}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KpiCard
          title="Orders"
          value={kpi.orders.toLocaleString()}
          change={kpi.ordersDelta}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <KpiCard
          title="Avg Order Value"
          value={formatCurrency(kpi.avgOrderValue)}
          change={kpi.aovDelta}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <KpiCard
          title="Conversion Rate"
          value={`${kpi.conversionRate}%`}
          change={kpi.conversionDelta}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Revenue Chart + Top Sellpages */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Revenue Chart Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue — Last 7 Days</CardTitle>
            <CardToolbar>
              <Badge variant="outline" size="sm">Daily</Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {/* Mini bar chart (CSS-only) */}
            <div className="flex items-end gap-2 h-[200px]">
              {mockRevenueChart.map((day) => {
                const maxRevenue = Math.max(...mockRevenueChart.map((d) => d.revenue));
                const heightPct = (day.revenue / maxRevenue) * 100;
                const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-2xs tabular-nums text-muted-foreground">
                      {formatCompact(day.revenue)}
                    </span>
                    <div
                      className="w-full bg-primary/20 rounded-t-md relative overflow-hidden transition-all hover:bg-primary/30"
                      style={{ height: `${heightPct}%` }}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md transition-all"
                        style={{ height: `${Math.min(heightPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-2xs text-muted-foreground">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="text-2sm text-muted-foreground">
                Total:{' '}
                <span className="font-bold text-foreground">
                  {formatCurrency(mockRevenueChart.reduce((s, d) => s + d.revenue, 0))}
                </span>
              </span>
              <span className="text-2sm text-muted-foreground">
                {mockRevenueChart.reduce((s, d) => s + d.orders, 0)} orders
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Top Sellpages */}
        <Card>
          <CardHeader>
            <CardTitle>Top Sellpages</CardTitle>
            <CardToolbar>
              <Button variant="ghost" size="sm" className="gap-1 text-2xs">
                View all <ArrowUpRight className="h-3 w-3" />
              </Button>
            </CardToolbar>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableBody>
                {mockTopSellpages.map((sp, idx) => (
                  <TableRow key={sp.slug}>
                    <TableCell className="w-8">
                      <span className="text-2xs font-bold text-muted-foreground/50">
                        {idx + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-2sm font-medium text-foreground truncate max-w-[130px]">
                          /{sp.slug}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          {sp.orders} orders · {sp.conversion}% CVR
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-2sm font-bold tabular-nums text-green-400">
                        {formatCurrency(sp.revenue)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardToolbar>
            <Button variant="ghost" size="sm" className="gap-1 text-2xs">
              View all <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardToolbar>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRecentOrders.map((order) => (
                <TableRow key={order.orderNumber} className="cursor-pointer">
                  <TableCell>
                    <span className="text-2sm font-mono font-medium text-foreground">
                      {order.orderNumber.replace('ORD-', '')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-2sm text-muted-foreground">{order.customer}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm font-medium tabular-nums text-foreground">
                      {formatCurrency(order.total)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
