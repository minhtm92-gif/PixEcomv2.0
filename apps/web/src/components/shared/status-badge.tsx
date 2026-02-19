import { Badge } from '@/components/ui/badge';

type StatusVariant = 'success' | 'warning' | 'destructive' | 'primary' | 'secondary' | 'info';

const STATUS_MAP: Record<string, StatusVariant> = {
  // Campaign / Ad
  ACTIVE: 'success',
  PAUSED: 'destructive',
  ARCHIVED: 'secondary',
  DELETED: 'destructive',

  // Sellpage
  PUBLISHED: 'success',
  DRAFT: 'warning',

  // Order
  PENDING: 'secondary',
  CONFIRMED: 'primary',
  PROCESSING: 'warning',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  REFUNDED: 'destructive',

  // Creative
  READY: 'success',

  // Domain
  VERIFIED: 'success',
  FAILED: 'destructive',

  // Asset source
  PIXCON: 'primary',
  USER_UPLOAD: 'info',
  PARTNER_API: 'secondary',

  // Media type
  VIDEO: 'primary',
  IMAGE: 'success',
  TEXT: 'secondary',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = STATUS_MAP[status] || 'secondary';
  return (
    <Badge variant={variant} className={className}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
