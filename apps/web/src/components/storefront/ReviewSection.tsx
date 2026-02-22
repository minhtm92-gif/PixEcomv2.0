import { Star } from 'lucide-react';
import { MockReview } from '@/mock/storefront';

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          className={
            s <= Math.round(rating)
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-200 fill-gray-200'
          }
        />
      ))}
    </div>
  );
}

interface ReviewSectionProps {
  reviews: MockReview[];
  rating: number;
  reviewCount: number;
}

export function ReviewSection({ reviews, rating, reviewCount }: ReviewSectionProps) {
  const breakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
  }));

  return (
    <div className="mt-14">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Customer Reviews</h2>

      <div className="flex flex-col md:flex-row gap-10 mb-10">
        {/* Rating summary */}
        <div className="flex flex-col items-center justify-center min-w-[120px] bg-gray-50 rounded-2xl p-6">
          <p className="text-5xl font-bold text-gray-900">{rating.toFixed(1)}</p>
          <StarRow rating={rating} size={16} />
          <p className="text-sm text-gray-500 mt-2">{reviewCount.toLocaleString()} reviews</p>
        </div>

        {/* Breakdown bars */}
        <div className="flex-1 space-y-2 justify-center flex flex-col">
          {breakdown.map(b => (
            <div key={b.star} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-3 text-right">{b.star}</span>
              <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{
                    width: reviews.length ? `${(b.count / reviews.length) * 100}%` : '0%',
                  }}
                />
              </div>
              <span className="text-xs text-gray-400 w-4">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review list */}
      <div className="space-y-8">
        {reviews.map(r => (
          <div key={r.id} className="border-b border-gray-100 pb-8 last:border-0 last:pb-0">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                {r.author.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                  <span className="font-semibold text-gray-900 text-sm">{r.author}</span>
                  {r.verified && (
                    <span className="text-xs text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                      ✓ Verified Purchase
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{r.date}</span>
                </div>
                <div className="mt-1">
                  <StarRow rating={r.rating} size={12} />
                </div>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">{r.title}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
