'use client';

import Link from 'next/link';
import { Shield, ShoppingBag, ExternalLink } from 'lucide-react';

export default function PreviewLandingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">PixEcom v2 — UI Preview</h1>
          <p className="text-muted-foreground">
            Preview all upcoming features. Static preview with mock data — no real API calls.
          </p>
        </div>

        <div className="grid gap-4">
          <Link
            href="/admin/dashboard"
            className="group bg-card border border-border rounded-xl p-6 hover:border-amber-500/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Shield size={24} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground group-hover:text-amber-400 transition-colors">
                  Admin Portal
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Dashboard, Sellers, Orders, Stores, Analytics, Settings (20 pages)
                </p>
              </div>
              <ExternalLink size={18} className="text-muted-foreground group-hover:text-amber-400" />
            </div>
          </Link>

          <a
            href="/demo-store"
            className="group bg-card border border-border rounded-xl p-6 hover:border-indigo-500/50 transition-colors block"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={24} className="text-indigo-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground group-hover:text-indigo-400 transition-colors">
                  Customer Storefront
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Store homepage, Product sellpage, Cart, Checkout, Order tracking
                </p>
              </div>
              <ExternalLink size={18} className="text-muted-foreground group-hover:text-indigo-400" />
            </div>
          </a>

          <div className="bg-card border border-border rounded-xl p-6 opacity-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={24} className="text-primary/50" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">Seller Portal</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Already live — requires API connection. Not in static preview.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          PixEcom v2 by Pixelxlab — Phase D Preview
        </p>
      </div>
    </div>
  );
}
