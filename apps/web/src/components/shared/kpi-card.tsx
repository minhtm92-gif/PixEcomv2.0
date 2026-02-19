import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  className?: string;
}

export function KpiCard({ title, value, change, icon, className }: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
            <span className="text-2xl font-bold text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
        {change !== undefined && (
          <div className="mt-2 flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                isPositive ? 'text-green-400' : 'text-red-400',
              )}
            >
              {isPositive ? '+' : ''}{change}%
            </span>
            <span className="text-xs text-muted-foreground">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
