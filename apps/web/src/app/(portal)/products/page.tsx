'use client';

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Package } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { mockProducts } from '@/mock/products';
import { formatCurrency } from '@/lib/helpers';
import type { ProductCardDto } from '@/mock/types';

const STATUS_OPTIONS = ['All', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const;
const LABEL_OPTIONS = ['All Labels', 'Health', 'Beauty', 'Trending', 'Best Seller', 'Grooming', 'Fitness'] as const;

function ProductCard({ product }: { product: ProductCardDto }) {
  const statusVariant = {
    ACTIVE: 'success' as const,
    DRAFT: 'warning' as const,
    ARCHIVED: 'secondary' as const,
  }[product.status];

  return (
    <Card className="group hover:border-primary/30 transition-colors duration-200">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-t-xl bg-muted/30">
        {product.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.heroImageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        <Badge variant={statusVariant} size="sm" className="absolute top-2.5 right-2.5">
          {product.status}
        </Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Labels */}
        <div className="flex flex-wrap gap-1.5">
          {product.labels.map((label) => (
            <Badge key={label.id} variant="outline" size="sm">
              {label.name}
            </Badge>
          ))}
        </div>

        {/* Title + Code */}
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {product.name}
          </h3>
          <p className="text-2xs text-muted-foreground mt-0.5">{product.code}</p>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline justify-between border-t border-border pt-2.5">
          <div>
            <p className="text-2xs text-muted-foreground">Retail Price</p>
            <p className="text-sm font-bold tabular-nums text-foreground">
              {formatCurrency(parseFloat(product.suggestedRetailPrice))}
            </p>
          </div>
          {product.youTakeEstimate && (
            <div className="text-right">
              <p className="text-2xs text-muted-foreground">You Take</p>
              <p className="text-sm font-bold tabular-nums text-green-400">
                {formatCurrency(parseFloat(product.youTakeEstimate))}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [labelFilter, setLabelFilter] = useState<string>('All Labels');

  const filtered = useMemo(() => {
    return mockProducts.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;

      const matchesLabel =
        labelFilter === 'All Labels' ||
        p.labels.some((l) => l.name === labelFilter);

      return matchesSearch && matchesStatus && matchesLabel;
    });
  }, [search, statusFilter, labelFilter]);

  const counts = useMemo(() => {
    return {
      all: mockProducts.length,
      active: mockProducts.filter((p) => p.status === 'ACTIVE').length,
      draft: mockProducts.filter((p) => p.status === 'DRAFT').length,
      archived: mockProducts.filter((p) => p.status === 'ARCHIVED').length,
    };
  }, []);

  return (
    <div className="container-fluid space-y-5">
      <PageHeader
        title="Products"
        subtitle="Browse the platform product catalog"
      />

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{counts.all} Total</Badge>
        <Badge variant="success">{counts.active} Active</Badge>
        <Badge variant="warning">{counts.draft} Draft</Badge>
        <Badge variant="outline">{counts.archived} Archived</Badge>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? `All Status` : s}
            </option>
          ))}
        </Select>
        <Select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)}>
          {LABEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </Button>
      </div>

      {/* Product Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No products match your filters</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setSearch('');
              setStatusFilter('All');
              setLabelFilter('All Labels');
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Results count */}
      <p className="text-2xs text-muted-foreground">
        Showing {filtered.length} of {mockProducts.length} products
      </p>
    </div>
  );
}
