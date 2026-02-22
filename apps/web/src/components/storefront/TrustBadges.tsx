import { Truck, RotateCcw, Shield, Award } from 'lucide-react';

const BADGES = [
  { icon: Truck, label: 'Free Shipping', sub: 'On orders over $50' },
  { icon: RotateCcw, label: '30-Day Returns', sub: 'Hassle-free' },
  { icon: Shield, label: 'Secure Payment', sub: 'SSL encrypted' },
  { icon: Award, label: 'Authentic Products', sub: 'Guaranteed quality' },
];

export function TrustBadges() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100">
      {BADGES.map(b => (
        <div key={b.label} className="flex flex-col items-center text-center gap-2 py-2">
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
            <b.icon size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900">{b.label}</p>
            <p className="text-xs text-gray-500">{b.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
