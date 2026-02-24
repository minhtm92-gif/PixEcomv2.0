'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

/** Shared review shape — works with both MockReview and API SellpageReview */
export interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
  images?: string[];
}

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
  reviews: ReviewItem[];
  rating: number;
  reviewCount: number;
  /** Called when a new review is submitted — parent adds it to list */
  onReviewSubmitted?: (review: ReviewItem) => void;
  /** Store slug + product ID for submitting reviews */
  storeSlug?: string;
  productId?: string;
}

export function ReviewSection({
  reviews,
  rating,
  reviewCount,
  onReviewSubmitted,
  storeSlug,
  productId,
}: ReviewSectionProps) {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const breakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
  }));

  return (
    <div className="mt-14">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Customer Reviews</h2>
        {storeSlug && productId && (
          <button
            onClick={() => setShowForm(f => !f)}
            className="px-4 py-2 text-sm font-semibold text-purple-600 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors"
          >
            {showForm ? 'Cancel' : 'Write a Review'}
          </button>
        )}
      </div>

      {/* Review submission form */}
      {showForm && storeSlug && productId && (
        <ReviewForm
          storeSlug={storeSlug}
          productId={productId}
          onSubmitted={(review) => {
            setShowForm(false);
            onReviewSubmitted?.(review);
          }}
        />
      )}

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
      {reviews.length > 0 ? (
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
              {r.images && r.images.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {r.images.map((img, i) => (
                    <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 cursor-pointer">
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover hover:scale-110 transition-transform"
                        onClick={() => setLightboxImg(img)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <p className="text-base">No reviews yet. Be the first to share your experience!</p>
        </div>
      )}

      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="Review"
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Review Form ────────────────────────────────────────────────────────────

function ReviewForm({
  storeSlug,
  productId,
  onSubmitted,
}: {
  storeSlug: string;
  productId: string;
  onSubmitted: (review: ReviewItem) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { submitReview } = await import('@/lib/storefrontApi');
      await submitReview(storeSlug, {
        authorName: name,
        authorEmail: email,
        rating: formRating,
        title,
        body,
        productId,
      });

      setSuccess(true);

      // Show as pending locally (won't appear in approved list until moderated)
      onSubmitted({
        id: `pending_${Date.now()}`,
        author: name,
        rating: formRating,
        date: new Date().toISOString().slice(0, 10),
        title,
        body,
        verified: false,
        images: [],
      });
    } catch (err: any) {
      setError(err.message ?? 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8 text-center">
        <p className="text-green-700 font-semibold">Thank you for your review!</p>
        <p className="text-green-600 text-sm mt-1">Your review has been submitted and is pending approval.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-2xl p-6 mb-8 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Your Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            placeholder="jane@example.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Rating *</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFormRating(s)}
              className="p-0.5"
            >
              <Star
                size={24}
                className={
                  s <= formRating
                    ? 'text-amber-400 fill-amber-400 cursor-pointer'
                    : 'text-gray-300 cursor-pointer hover:text-amber-200'
                }
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Review Title *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          maxLength={255}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          placeholder="Summarize your experience"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Your Review *</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          required
          maxLength={5000}
          rows={4}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
          placeholder="Share your thoughts about this product..."
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !name || !email || !title || !body}
        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
}
