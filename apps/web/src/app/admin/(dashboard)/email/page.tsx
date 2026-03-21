'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Mail,
  FileText,
  Settings,
  ShoppingCart,
  Send,
  Eye,
  MousePointerClick,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { useAdminApi } from '@/hooks/useAdminApi';
import { num, moneyWhole, pct } from '@/lib/format';

// ── API response types ──────────────────────────────────────────────────────

interface EmailOverview {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalFailed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  deliveryRate: number;
}

interface FlowStats {
  flowId: string;
  flowName: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

interface RecoveryStats {
  totalAbandoned: number;
  totalRecovered: number;
  recoveryRate: number;
  revenueRecovered: number;
  cartAbandoned: number;
  cartRecovered: number;
  cartRecoveryRate: number;
  checkoutAbandoned: number;
  checkoutRecovered: number;
  checkoutRecoveryRate: number;
}

export default function EmailDashboardPage() {
  // Default date range: last 30 days → now (ISO 8601)
  const dateRange = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return `from=${from.toISOString()}&to=${to.toISOString()}`;
  }, []);

  const { data: overview, loading: loadingOverview, error: errorOverview } = useAdminApi<EmailOverview>(`/email-analytics/overview?${dateRange}`);
  const { data: flowsData, loading: loadingFlows } = useAdminApi<{ flows: FlowStats[] } | FlowStats[]>(`/email-analytics/flows?${dateRange}`);
  const { data: recovery, loading: loadingRecovery } = useAdminApi<RecoveryStats>(`/email-analytics/recovery?${dateRange}`);

  const loading = loadingOverview || loadingFlows || loadingRecovery;

  // Normalize flows data (could be { flows: [...] } or [...])
  const flows: FlowStats[] = useMemo(() => {
    if (!flowsData) return [];
    if (Array.isArray(flowsData)) return flowsData;
    if ('flows' in flowsData && Array.isArray(flowsData.flows)) return flowsData.flows;
    return [];
  }, [flowsData]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading email analytics...</p>
        </div>
      </div>
    );
  }

  if (errorOverview) {
    return (
      <PageShell
        icon={<Mail size={20} className="text-amber-400" />}
        title="Email Marketing"
        subtitle="Email performance overview and analytics"
      >
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {errorOverview}
        </div>
      </PageShell>
    );
  }

  const flowColumns: Column<FlowStats>[] = [
    {
      key: 'flowName',
      label: 'Flow',
      render: (r) => (
        <span className="text-sm font-medium text-foreground">{r.flowName}</span>
      ),
    },
    {
      key: 'sent',
      label: 'Sent',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm text-foreground">{num(r.sent)}</span>,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className="font-mono text-sm text-foreground">{num(r.delivered)}</span>,
    },
    {
      key: 'opened',
      label: 'Opened',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className="font-mono text-sm text-foreground">{num(r.opened)}</span>,
    },
    {
      key: 'clicked',
      label: 'Clicked',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className="font-mono text-sm text-foreground">{num(r.clicked)}</span>,
    },
    {
      key: 'openRate',
      label: 'Open Rate',
      className: 'text-right',
      render: (r) => (
        <span className={`font-mono text-sm ${r.openRate >= 25 ? 'text-green-400' : r.openRate >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
          {pct(r.openRate)}
        </span>
      ),
    },
    {
      key: 'clickRate',
      label: 'Click Rate',
      className: 'text-right',
      render: (r) => (
        <span className={`font-mono text-sm ${r.clickRate >= 5 ? 'text-green-400' : r.clickRate >= 2 ? 'text-amber-400' : 'text-red-400'}`}>
          {pct(r.clickRate)}
        </span>
      ),
    },
  ];

  return (
    <PageShell
      icon={<Mail size={20} className="text-amber-400" />}
      title="Email Marketing"
      subtitle="Email performance overview and analytics"
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/admin/email/templates"
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground font-medium rounded-lg text-sm hover:bg-muted transition-colors"
          >
            <FileText size={16} />
            Templates
          </Link>
          <Link
            href="/admin/email/settings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground font-medium rounded-lg text-sm hover:bg-muted transition-colors"
          >
            <Settings size={16} />
            Settings
          </Link>
        </div>
      }
    >
      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Sent"
          value={num(overview?.totalSent ?? 0)}
          icon={<Send size={14} />}
        />
        <KpiCard
          label="Open Rate"
          value={pct(overview?.openRate ?? 0)}
          icon={<Eye size={14} />}
          sub={`${num(overview?.totalOpened ?? 0)} opened`}
        />
        <KpiCard
          label="Click Rate"
          value={pct(overview?.clickRate ?? 0)}
          icon={<MousePointerClick size={14} />}
          sub={`${num(overview?.totalClicked ?? 0)} clicked`}
        />
        <KpiCard
          label="Bounce Rate"
          value={pct(overview?.bounceRate ?? 0)}
          icon={<AlertTriangle size={14} />}
          sub={`${num(overview?.totalBounced ?? 0)} bounced`}
        />
      </div>

      {/* Recovery Stats Section */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart size={14} className="text-amber-400" />
            Cart Recovery
          </h2>
          <Link
            href="/admin/email/recovery"
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
          >
            View All <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Abandoned Carts</p>
            <p className="text-2xl font-bold text-foreground">{num(recovery?.totalAbandoned ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Recovery Rate</p>
            <p className="text-2xl font-bold text-green-400">{pct(recovery?.recoveryRate ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Revenue Recovered</p>
            <p className="text-2xl font-bold text-foreground">{moneyWhole(recovery?.revenueRecovered ?? 0)}</p>
          </div>
        </div>

        {/* Cart vs Checkout comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={18} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Cart Abandonment</p>
              <p className="text-xs text-muted-foreground">{num(recovery?.cartAbandoned ?? 0)} abandoned, {num(recovery?.cartRecovered ?? 0)} recovered</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-medium text-foreground">{pct(recovery?.cartRecoveryRate ?? 0)}</p>
              <p className="text-xs text-muted-foreground">recovery</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={18} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Checkout Abandonment</p>
              <p className="text-xs text-muted-foreground">{num(recovery?.checkoutAbandoned ?? 0)} abandoned, {num(recovery?.checkoutRecovered ?? 0)} recovered</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-medium text-foreground">{pct(recovery?.checkoutRecoveryRate ?? 0)}</p>
              <p className="text-xs text-muted-foreground">recovery</p>
            </div>
          </div>
        </div>
      </div>

      {/* Flow Performance Table */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Send size={14} className="text-amber-400" />
          Flow Performance
        </h2>
        <DataTable
          columns={flowColumns}
          data={flows}
          loading={false}
          emptyMessage="No email flow data yet."
          rowKey={(r) => r.flowId}
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link
          href="/admin/email/templates"
          className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-amber-500/40 hover:bg-muted/20 transition-colors group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Email Templates</p>
            <p className="text-xs text-muted-foreground mt-0.5">Manage email templates and flows</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground/40 group-hover:text-amber-400 transition-colors flex-shrink-0" />
        </Link>
        <Link
          href="/admin/email/settings"
          className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-amber-500/40 hover:bg-muted/20 transition-colors group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Settings size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Email Settings</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sender identity and configuration</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground/40 group-hover:text-amber-400 transition-colors flex-shrink-0" />
        </Link>
        <Link
          href="/admin/email/recovery"
          className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-amber-500/40 hover:bg-muted/20 transition-colors group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <ShoppingCart size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Cart Recovery</p>
            <p className="text-xs text-muted-foreground mt-0.5">Abandoned carts and recovery emails</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground/40 group-hover:text-amber-400 transition-colors flex-shrink-0" />
        </Link>
      </div>
    </PageShell>
  );
}
