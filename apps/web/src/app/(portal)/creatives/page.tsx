'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Image as ImageIcon,
  Film,
  Layers,
  Eye,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { mockCreatives } from '@/mock/creatives';
import { timeAgo } from '@/lib/helpers';
import type { CreativeDto } from '@/mock/types';

const STATUS_OPTIONS = ['All', 'DRAFT', 'READY', 'IN_USE', 'ARCHIVED'] as const;
const TYPE_OPTIONS = ['All Types', 'IMAGE', 'VIDEO', 'CAROUSEL'] as const;

function getTypeIcon(type: CreativeDto['type']) {
  switch (type) {
    case 'VIDEO':
      return <Film className="h-3.5 w-3.5" />;
    case 'CAROUSEL':
      return <Layers className="h-3.5 w-3.5" />;
    default:
      return <ImageIcon className="h-3.5 w-3.5" />;
  }
}

function CreativeCard({
  creative,
  onClick,
}: {
  creative: CreativeDto;
  onClick: () => void;
}) {
  return (
    <Card
      className="group cursor-pointer hover:border-primary/30 transition-colors overflow-hidden"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-muted/20 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={creative.thumbnailUrl}
          alt={creative.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="h-6 w-6 text-white" />
        </div>
        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant="secondary" size="sm" className="gap-1">
            {getTypeIcon(creative.type)}
            {creative.type}
          </Badge>
        </div>
        <div className="absolute top-2 right-2">
          <StatusBadge status={creative.status} />
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <h3 className="text-2sm font-semibold text-foreground line-clamp-1">
          {creative.name}
        </h3>
        <p className="text-2xs text-muted-foreground line-clamp-2 leading-relaxed">
          {creative.primaryText}
        </p>
        <div className="flex items-center justify-between pt-1">
          {creative.productName ? (
            <span className="text-2xs text-primary truncate max-w-[150px]">
              {creative.productName}
            </span>
          ) : (
            <span className="text-2xs text-muted-foreground/50">Multi-product</span>
          )}
          <span className="text-2xs text-muted-foreground">{timeAgo(creative.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Creative Preview Drawer ─── */
function CreativePreviewDrawer({
  creative,
  onClose,
}: {
  creative: CreativeDto | null;
  onClose: () => void;
}) {
  if (!creative) return null;

  return (
    <Sheet open={!!creative} onClose={onClose} width="max-w-[480px]">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-3">
          <SheetTitle className="line-clamp-1">{creative.name}</SheetTitle>
          <StatusBadge status={creative.status} />
        </div>
        <SheetDescription>
          {creative.type} · Updated {timeAgo(creative.updatedAt)}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={creative.thumbnailUrl}
            alt={creative.name}
            className="w-full aspect-square object-cover"
          />
        </div>

        {/* Ad Copy Preview */}
        <section className="space-y-3">
          <h4 className="text-2sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Ad Copy
          </h4>
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">{creative.primaryText}</p>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2sm font-bold text-foreground">{creative.headline}</p>
                {creative.productName && (
                  <p className="text-2xs text-muted-foreground">{creative.productName}</p>
                )}
              </div>
              <Badge variant="primary" size="sm">
                {creative.callToAction}
              </Badge>
            </div>
          </div>
        </section>

        <Separator />

        {/* Metadata */}
        <section className="space-y-2">
          <h4 className="text-2sm font-semibold text-foreground">Details</h4>
          <div className="grid grid-cols-2 gap-2 text-2sm">
            <div>
              <p className="text-2xs text-muted-foreground">Type</p>
              <div className="flex items-center gap-1.5 text-foreground">
                {getTypeIcon(creative.type)}
                {creative.type}
              </div>
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Status</p>
              <StatusBadge status={creative.status} />
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Assets</p>
              <p className="text-foreground">{creative.assetIds.length} file(s)</p>
            </div>
            <div>
              <p className="text-2xs text-muted-foreground">Product</p>
              <p className="text-foreground truncate">
                {creative.productName || 'Multi-product'}
              </p>
            </div>
          </div>
        </section>
      </SheetBody>
    </Sheet>
  );
}

/* ─── Main Creatives Page ─── */
export default function CreativesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All Types');
  const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return mockCreatives.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.headline.toLowerCase().includes(search.toLowerCase()) ||
        (c.productName?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchesType = typeFilter === 'All Types' || c.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [search, statusFilter, typeFilter]);

  const counts = useMemo(() => ({
    all: mockCreatives.length,
    inUse: mockCreatives.filter((c) => c.status === 'IN_USE').length,
    ready: mockCreatives.filter((c) => c.status === 'READY').length,
    draft: mockCreatives.filter((c) => c.status === 'DRAFT').length,
  }), []);

  const selectedCreative = selectedCreativeId
    ? mockCreatives.find((c) => c.id === selectedCreativeId) ?? null
    : null;

  return (
    <div className="container-fluid space-y-5">
      <PageHeader
        title="Creatives"
        subtitle="Ad creative bundles"
        action={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Creative
          </Button>
        }
      />

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{counts.all} Total</Badge>
        <Badge variant="success">{counts.inUse} In Use</Badge>
        <Badge variant="primary">{counts.ready} Ready</Badge>
        <Badge variant="warning">{counts.draft} Draft</Badge>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search creatives…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All Status' : s.replace('_', ' ')}
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

      {/* Creatives Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((creative) => (
            <CreativeCard
              key={creative.id}
              creative={creative}
              onClick={() => setSelectedCreativeId(creative.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No creatives match your filters</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setSearch('');
              setStatusFilter('All');
              setTypeFilter('All Types');
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Results count */}
      <p className="text-2xs text-muted-foreground">
        Showing {filtered.length} of {mockCreatives.length} creatives
      </p>

      {/* Creative Preview Drawer */}
      <CreativePreviewDrawer
        creative={selectedCreative}
        onClose={() => setSelectedCreativeId(null)}
      />
    </div>
  );
}
