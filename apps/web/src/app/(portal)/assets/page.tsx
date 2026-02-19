'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Upload,
  Image as ImageIcon,
  Film,
  FileType,
  Grid3X3,
  List,
  HardDrive,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { mockAssets } from '@/mock/assets';
import { formatBytes, formatDate, timeAgo } from '@/lib/helpers';
import type { AssetDto } from '@/mock/types';

const TYPE_OPTIONS = ['All Types', 'image', 'video', 'svg'] as const;

function getMimeIcon(mime: string) {
  if (mime.startsWith('video/')) return <Film className="h-4 w-4 text-violet-400" />;
  if (mime === 'image/svg+xml') return <FileType className="h-4 w-4 text-yellow-400" />;
  return <ImageIcon className="h-4 w-4 text-green-400" />;
}

function getMimeLabel(mime: string) {
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime === 'image/svg+xml') return 'SVG';
  if (mime.startsWith('image/')) return 'IMAGE';
  return 'FILE';
}

function AssetGridCard({ asset }: { asset: AssetDto }) {
  return (
    <Card className="group overflow-hidden hover:border-primary/30 transition-colors">
      <div className="relative aspect-square bg-muted/20 overflow-hidden">
        {asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={asset.originalName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {getMimeIcon(asset.mimeType)}
          </div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge variant="secondary" size="sm">
            {getMimeLabel(asset.mimeType)}
          </Badge>
        </div>
        {asset.width && asset.height && (
          <span className="absolute bottom-2 left-2 text-2xs bg-black/60 text-white/80 px-1.5 py-0.5 rounded font-mono">
            {asset.width}×{asset.height}
          </span>
        )}
      </div>
      <CardContent className="p-3 space-y-1.5">
        <p className="text-2sm font-medium text-foreground truncate" title={asset.originalName}>
          {asset.filename}
        </p>
        <div className="flex items-center justify-between text-2xs text-muted-foreground">
          <span>{formatBytes(asset.sizeBytes)}</span>
          <span>{timeAgo(asset.createdAt)}</span>
        </div>
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {asset.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AssetsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All Types');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(() => {
    return mockAssets.filter((a) => {
      const matchesSearch =
        !search ||
        a.filename.toLowerCase().includes(search.toLowerCase()) ||
        a.originalName.toLowerCase().includes(search.toLowerCase()) ||
        a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      let matchesType = true;
      if (typeFilter === 'image') matchesType = a.mimeType.startsWith('image/') && a.mimeType !== 'image/svg+xml';
      else if (typeFilter === 'video') matchesType = a.mimeType.startsWith('video/');
      else if (typeFilter === 'svg') matchesType = a.mimeType === 'image/svg+xml';

      return matchesSearch && matchesType;
    });
  }, [search, typeFilter]);

  const totalSize = useMemo(
    () => mockAssets.reduce((sum, a) => sum + a.sizeBytes, 0),
    [],
  );

  const counts = useMemo(() => ({
    all: mockAssets.length,
    images: mockAssets.filter((a) => a.mimeType.startsWith('image/') && a.mimeType !== 'image/svg+xml').length,
    videos: mockAssets.filter((a) => a.mimeType.startsWith('video/')).length,
  }), []);

  return (
    <div className="container-fluid space-y-5">
      <PageHeader
        title="Assets"
        subtitle="Media file registry"
        action={
          <Button size="sm" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
        }
      />

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{counts.all} Files</Badge>
        <Badge variant="success">{counts.images} Images</Badge>
        <Badge variant="primary">{counts.videos} Videos</Badge>
        <Badge variant="outline">
          <HardDrive className="h-3 w-3 mr-1" />
          {formatBytes(totalSize)}
        </Badge>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search assets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === 'All Types' ? 'All Types' : t.toUpperCase()}
            </option>
          ))}
        </Select>
        <div className="flex border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1.5 transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((asset) => (
            <AssetGridCard key={asset.id} asset={asset} />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="h-8 w-8 rounded bg-muted/30 overflow-hidden flex items-center justify-center">
                      {asset.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getMimeIcon(asset.mimeType)
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-2sm font-medium text-foreground truncate max-w-[200px]">
                        {asset.filename}
                      </p>
                      <p className="text-2xs text-muted-foreground truncate max-w-[200px]">
                        {asset.originalName}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" size="sm">
                      {getMimeLabel(asset.mimeType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {asset.width && asset.height ? (
                      <span className="text-2xs font-mono text-muted-foreground">
                        {asset.width}×{asset.height}
                      </span>
                    ) : (
                      <span className="text-2xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm tabular-nums text-muted-foreground">
                      {formatBytes(asset.sizeBytes)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2xs text-muted-foreground">
                      {formatDate(asset.createdAt)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Results count */}
      <p className="text-2xs text-muted-foreground">
        Showing {filtered.length} of {mockAssets.length} assets
      </p>
    </div>
  );
}
