import { Zap, Tag } from 'lucide-react';
import { MockBoostModule } from '@/mock/storefront';

interface BoostModuleProps {
  modules: MockBoostModule[];
}

export function BoostModule({ modules }: BoostModuleProps) {
  if (!modules.length) return null;

  return (
    <div className="space-y-3">
      {modules.map((m, i) => {
        if (m.type === 'BUNDLE_DISCOUNT' && m.tiers) {
          return (
            <div key={i} className="rounded-xl border border-purple-200 bg-purple-50 overflow-hidden">
              <div className="px-4 py-2.5 bg-purple-100 flex items-center gap-2 border-b border-purple-200">
                <Zap size={15} className="text-purple-600 fill-purple-600" />
                <span className="text-sm font-semibold text-purple-800">{m.title}</span>
              </div>
              <div className="divide-y divide-purple-100">
                {m.tiers.map((t, j) => (
                  <div key={j} className="px-4 py-2 flex justify-between items-center">
                    <span className="text-sm text-gray-700">
                      Buy <span className="font-semibold text-gray-900">{t.qty}</span> items
                    </span>
                    <span className="text-sm font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      {t.discount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (m.type === 'EXTRA_OFF') {
          return (
            <div
              key={i}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3"
            >
              <Tag size={17} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{m.title}</p>
                {m.description && (
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{m.description}</p>
                )}
              </div>
            </div>
          );
        }

        if (m.type === 'UPSELL_NEXT_ITEM') {
          return (
            <div
              key={i}
              className="border border-dashed border-green-500 rounded bg-green-50 py-2 px-1.5 flex flex-col items-center justify-center text-center"
            >
              <span className="text-base font-extrabold uppercase tracking-wide text-green-700">{m.title}</span>
              {m.description && (
                <span className="text-base font-medium text-green-600">{m.description}</span>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
