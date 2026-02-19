import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdsManagerPage() {
  return (
    <div className="container-fluid space-y-6">
      <PageHeader title="Ads Manager" subtitle="Campaign performance" />
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
