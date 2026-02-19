'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Play,
  Pause,
  AlertCircle,
  DollarSign,
  MousePointerClick,
  Eye,
  Target,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { mockCampaigns } from '@/mock/campaigns';
import { formatCurrency, formatCompact, formatDate } from '@/lib/helpers';
import type { CampaignDto } from '@/mock/types';

const STATUS_OPTIONS = ['All', 'ACTIVE', 'PAUSED', 'DRAFT', 'COMPLETED', 'ERROR'] as const;
const PLATFORM_OPTIONS = ['All Platforms', 'FACEBOOK', 'TIKTOK', 'GOOGLE'] as const;

function PlatformBadge({ platform }: { platform: CampaignDto['platform'] }) {
  const colors: Record<string, string> = {
    FACEBOOK: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    TIKTOK: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
    GOOGLE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 h-5 text-2xs font-medium border ${colors[platform] || ''}`}
    >
      {platform}
    </span>
  );
}

function StatusIcon({ status }: { status: CampaignDto['status'] }) {
  switch (status) {
    case 'ACTIVE':
      return <Play className="h-3 w-3 text-green-400 fill-green-400" />;
    case 'PAUSED':
      return <Pause className="h-3 w-3 text-yellow-400" />;
    case 'ERROR':
      return <AlertCircle className="h-3 w-3 text-red-400" />;
    default:
      return null;
  }
}

export default function AdsManagerPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [platformFilter, setPlatformFilter] = useState<string>('All Platforms');

  const filtered = useMemo(() => {
    return mockCampaigns.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.objective.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchesPlatform = platformFilter === 'All Platforms' || c.platform === platformFilter;

      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [search, statusFilter, platformFilter]);

  const totals = useMemo(() => {
    const active = mockCampaigns.filter((c) => c.status === 'ACTIVE');
    return {
      campaigns: mockCampaigns.length,
      active: active.length,
      totalSpent: mockCampaigns.reduce((s, c) => s + parseFloat(c.totalSpent), 0),
      totalImpressions: mockCampaigns.reduce((s, c) => s + c.impressions, 0),
      totalClicks: mockCampaigns.reduce((s, c) => s + c.clicks, 0),
      totalConversions: mockCampaigns.reduce((s, c) => s + c.conversions, 0),
    };
  }, []);

  return (
    <div className="container-fluid space-y-5">
      <PageHeader
        title="Ads Manager"
        subtitle="Campaign performance & management"
        action={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Campaign
          </Button>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <DollarSign className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Total Spent</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(totals.totalSpent)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Impressions</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatCompact(totals.totalImpressions)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <MousePointerClick className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Total Clicks</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatCompact(totals.totalClicks)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
              <Target className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Conversions</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatCompact(totals.totalConversions)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{totals.campaigns} Campaigns</Badge>
        <Badge variant="success">{totals.active} Active</Badge>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All Status' : s}
            </option>
          ))}
        </Select>
        <Select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === 'All Platforms' ? 'All Platforms' : p}
            </option>
          ))}
        </Select>
      </div>

      {/* Campaigns Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Campaign</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Budget/Day</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">CPC</TableHead>
              <TableHead className="text-right">Conv.</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusIcon status={c.status} />
                      <div>
                        <p className="text-2sm font-medium text-foreground truncate max-w-[220px]">
                          {c.name}
                        </p>
                        <p className="text-2xs text-muted-foreground">{c.objective}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PlatformBadge platform={c.platform} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm tabular-nums text-muted-foreground">
                      {formatCurrency(parseFloat(c.dailyBudget))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm font-medium tabular-nums text-foreground">
                      {formatCurrency(parseFloat(c.totalSpent))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm tabular-nums text-muted-foreground">
                      {formatCompact(c.impressions)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm tabular-nums text-muted-foreground">
                      {formatCompact(c.clicks)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm tabular-nums text-muted-foreground">
                      {c.ctr}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm tabular-nums text-muted-foreground">
                      ${c.cpc}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm font-medium tabular-nums text-foreground">
                      {c.conversions}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-2sm font-bold tabular-nums ${
                        parseFloat(c.roas) >= 3
                          ? 'text-green-400'
                          : parseFloat(c.roas) >= 2
                            ? 'text-yellow-400'
                            : parseFloat(c.roas) > 0
                              ? 'text-red-400'
                              : 'text-muted-foreground/50'
                      }`}
                    >
                      {parseFloat(c.roas) > 0 ? `${c.roas}×` : '—'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Target className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No campaigns found</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('All');
                        setPlatformFilter('All Platforms');
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Results count */}
      <p className="text-2xs text-muted-foreground">
        Showing {filtered.length} of {mockCampaigns.length} campaigns
      </p>
    </div>
  );
}
