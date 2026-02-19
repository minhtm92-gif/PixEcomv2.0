import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductsPage() {
  return (
    <div className="container-fluid space-y-6">
      <PageHeader title="Products" subtitle="Browse platform product catalog" />
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
