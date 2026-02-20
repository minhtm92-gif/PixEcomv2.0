'use client';

const COLOR_MAP: Record<string, string> = {
  // Orders
  PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PROCESSING: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  SHIPPED: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  DELIVERED: 'bg-green-500/10 text-green-400 border-green-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  REFUNDED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  // Ads / Sellpages
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/20',
  PAUSED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  ARCHIVED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  DRAFT: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  COMPLETED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PUBLISHED: 'bg-green-500/10 text-green-400 border-green-500/20',
};

const FALLBACK = 'bg-gray-500/10 text-gray-400 border-gray-500/20';

export function StatusBadge({ status }: { status: string }) {
  const color = COLOR_MAP[status.toUpperCase()] ?? FALLBACK;
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium uppercase ${color}`}>
      {status}
    </span>
  );
}
