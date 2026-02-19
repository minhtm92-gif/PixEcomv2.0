import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function SellpagesPage() {
  return (
    <div className="container-fluid space-y-6">
      <PageHeader title="Sellpages" subtitle="Manage your landing pages" />
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
