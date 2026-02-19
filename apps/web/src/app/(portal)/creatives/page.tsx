import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreativesPage() {
  return (
    <div className="container-fluid space-y-6">
      <PageHeader title="Creatives" subtitle="Creative bundles" />
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
