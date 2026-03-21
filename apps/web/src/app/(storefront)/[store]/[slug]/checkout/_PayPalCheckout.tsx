'use client';

import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '';

// ─── Exported wrapper ────────────────────────────────────────────────────────

export interface PayPalCheckoutProps {
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onError: (err: unknown) => void;
  disabled: boolean;
}

export default function PayPalCheckout({
  createOrder,
  onApprove,
  onError,
  disabled,
}: PayPalCheckoutProps) {
  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'USD' }}>
      <div className="mt-4">
        <PayPalButtons
          style={{ layout: 'vertical', shape: 'pill', label: 'pay' }}
          createOrder={createOrder}
          onApprove={onApprove}
          onError={onError}
          disabled={disabled}
        />
      </div>
    </PayPalScriptProvider>
  );
}
