'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  Copy,
  MoreHorizontal,
  Plus,
  Globe,
  FileText,
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
import { mockSellpages } from '@/mock/sellpages';
import { formatCurrency, formatDate, timeAgo } from '@/lib/helpers';
import type { SellpageCardDto } from '@/mock/types';

const STATUS_OPTIONS = ['All', 'PUBLISHED', 'DRAFT', 'ARCHIVED'] as const;
const TYPE_OPTIONS = ['All Types', 'SINGLE', 'MULTIPLE'] as const;

function UrlCell({ url }: { url: string }) {
  const isUnassigned = url.startsWith('<');
  return (
    <div className="flex items-center gap-1.5 max-w-[220px]">
      {isUnassigned ? (
        <span className="text-2xs text-muted-foreground/60 italic truncate">
          No domain assigned
        </span>
      ) : (
        <>
          <span className="text-2xs text-muted-foreground truncate">{url}</span>
          <button
            className="shrink-0 text-muted-foreground/60 hover:text-primary transition-colors"
            title="Copy URL"
          >
            <Copy className="h-3 w-3" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground/60 hover:text-primary transition-colors"
            title="Open"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </>
      )}
    </div>
  );
}

function StatsCell({ stats }: { stats: SellpageCardDto['stats'] }) {
  if (stats.revenue === 0) {
    return <span className="text-2xs text-muted-foreground/50">—</span>;
  }
  return (
    <div className="space-y-0.5">
      <p className="text-2sm font-medium tabular-nums text-foreground">
        {formatCurrency(stats.revenue)}
      </p>
      <p className="text-2xs text-green-400 tabular-nums">
        Take: {formatCurrency(stats.youTake)}
      </p>
    </div>
  );
}

export default function SellpagesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All Types');

  const filtered = useMemo(() => {
    return mockSellpages.filter((sp) => {
      const matchesSearch =
        !search ||
        sp.slug.toLowerCase().includes(search.toLowerCase()) ||
        (sp.titleOverride?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (sp.productName?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesStatus = statusFilter === 'All' || sp.status === statusFilter;
      const matchesType = typeFilter === 'All Types' || sp.sellpageType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [search, statusFilter, typeFilter]);

  const counts = useMemo(() => {
    return {
      all: mockSellpages.length,
      published: mockSellpages.filter((s) => s.status === 'PUBLISHED').length,
      draft: mockSellpages.filter((s) => s.status === 'DRAFT').length,
      archived: mockSellpages.filter((s) => s.status === 'ARCHIVED').length,
    };
  }, []);

  return (
    <div className="container-fluid space-y-5">
      <PageHeader
        title="Sellpages"
        subtitle="Manage your landing pages"
        action={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Sellpage
          </Button>
        }
      />

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{counts.all} Total</Badge>
        <Badge variant="success">{counts.published} Published</Badge>
        <Badge variant="warning">{counts.draft} Draft</Badge>
        <Badge variant="outline">{counts.archived} Archived</Badge>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search sellpages…"
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
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === 'All Types' ? 'All Types' : t}
            </option>
          ))}
        </Select>
      </div>

      {/* Sellpages Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">Sellpage</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Updated</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((sp) => (
                <TableRow key={sp.id} className="cursor-pointer">
                  <TableCell>
                    <div>
                      <p className="text-2sm font-medium text-foreground truncate max-w-[260px]">
                        {sp.titleOverride || sp.slug}
                      </p>
                      <p className="text-2xs text-muted-foreground">/{sp.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-2sm text-muted-foreground truncate max-w-[180px] block">
                      {sp.productName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={sp.status} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" size="sm" className="gap-1">
                      {sp.sellpageType === 'MULTIPLE' ? (
                        <FileText className="h-3 w-3" />
                      ) : (
                        <Globe className="h-3 w-3" />
                      )}
                      {sp.sellpageType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UrlCell url={sp.urlPreview} />
                  </TableCell>
                  <TableCell className="text-right">
                    <StatsCell stats={sp.stats} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-right">
                      <p className="text-2xs text-muted-foreground">
                        {timeAgo(sp.updatedAt)}
                      </p>
                      <p className="text-2xs text-muted-foreground/60">
                        {formatDate(sp.createdAt)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors rounded">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No sellpages found</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('All');
                        setTypeFilter('All Types');
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
        Showing {filtered.length} of {mockSellpages.length} sellpages
      </p>
    </div>
  );
}
