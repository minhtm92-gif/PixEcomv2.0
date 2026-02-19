import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, children, className }: PageHeaderProps) {
  const trailing = action || children;
  return (
    <div className={cn('flex items-center flex-wrap gap-2 justify-between', className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {trailing && <div className="flex items-center gap-2.5">{trailing}</div>}
    </div>
  );
}
