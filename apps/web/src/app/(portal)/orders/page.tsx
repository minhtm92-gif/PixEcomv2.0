import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrdersPage() {
  return (
    <div className="container-fluid space-y-6">
      <PageHeader title="Orders" subtitle="Track customer orders" />
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
