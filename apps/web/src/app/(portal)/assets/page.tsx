import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function AssetsPage() {
  return (
    <div className="container-fluid space-y-6">
      <PageHeader title="Assets" subtitle="Asset registry" />
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
