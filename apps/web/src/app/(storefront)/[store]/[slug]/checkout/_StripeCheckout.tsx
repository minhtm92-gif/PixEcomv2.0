'use client';

import { useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
);

// ─── Card element styling ────────────────────────────────────────────────────

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '14px',
      color: '#1f2937',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
};

// ─── Inner form that uses Stripe hooks ───────────────────────────────────────

function StripeCardForm({
  onReady,
}: {
  onReady: (confirm: (clientSecret: string) => Promise<string | null>) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) return;

    // Expose the confirm function to the parent
    onReady(async (clientSecret: string) => {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) return 'Card element not found';

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) return error.message ?? 'Payment failed';
      if (paymentIntent?.status === 'succeeded') return null; // success
      return `Payment status: ${paymentIntent?.status}`;
    });
  }, [stripe, elements, onReady]);

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Card Details</label>
        <div className="px-3 py-3 border border-gray-200 rounded-xl bg-white">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Lock size={10} /> Secured by Stripe — we never see your card details
      </p>
    </div>
  );
}

// ─── Exported wrapper ────────────────────────────────────────────────────────

export interface StripeCheckoutProps {
  onReady: (confirm: (clientSecret: string) => Promise<string | null>) => void;
}

export default function StripeCheckout({ onReady }: StripeCheckoutProps) {
  return (
    <Elements stripe={stripePromise}>
      <StripeCardForm onReady={onReady} />
    </Elements>
  );
}
