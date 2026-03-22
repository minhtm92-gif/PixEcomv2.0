'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ── Column definition ── */
export interface Column<T> {
  key: string;
  label: ReactNode;
  className?: string;
  hiddenOnMobile?: boolean;
  render: (row: T, idx: number) => ReactNode;
}

/* ── Props ── */
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
<<<<<<< HEAD
=======
  rowClassName?: (row: T, idx: number) => string;
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
<<<<<<< HEAD
=======
  rowClassName,
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  emptyMessage = 'No data found.',
  onRowClick,
  rowKey,
}: DataTableProps<T>) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] md:min-w-0 text-sm">
          {/* Sticky header */}
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-left px-2 py-2 md:px-4 md:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap',
                    col.hiddenOnMobile && 'hidden md:table-cell',
                    col.className,
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-2 py-2 md:px-4 md:py-3', col.hiddenOnMobile && 'hidden md:table-cell')}>
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-2 py-8 md:px-4 md:py-16 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/40',
<<<<<<< HEAD
=======
                    rowClassName?.(row, idx),
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-2 py-2 md:px-4 md:py-3', col.hiddenOnMobile && 'hidden md:table-cell', col.className)}>
                      {col.render(row, idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
