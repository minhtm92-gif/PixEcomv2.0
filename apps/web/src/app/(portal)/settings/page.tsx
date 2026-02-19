import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsPage() {
  return (
    <div className="container-fluid space-y-6">
      <PageHeader title="Settings" subtitle="Account settings" />
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
