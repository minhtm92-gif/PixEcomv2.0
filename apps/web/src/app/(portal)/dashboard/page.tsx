import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  return (
    <div className="container-fluid space-y-6">
      <PageHeader title="Dashboard" subtitle="Welcome back, Demo Seller" />

      {/* KPI Placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>

      {/* Chart + Table Placeholder */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Skeleton className="h-[300px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>

      <Skeleton className="h-[250px] rounded-xl" />
    </div>
  );
}
