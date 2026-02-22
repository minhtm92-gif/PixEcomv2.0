'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

export default function NewSellerPage() {
  const router = useRouter();

  return (
    <div className="p-6 max-w-xl">
      <button onClick={() => router.push('/admin/sellers')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Sellers
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <UserPlus size={22} className="text-amber-400" />
          Add New Seller
        </h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Store Name <span className="text-red-400">*</span>
            </label>
            <input type="text" className={inputCls} placeholder="My Awesome Store" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input type="email" className={inputCls} placeholder="seller@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
            <input type="text" className={inputCls} placeholder="+84 912 345 678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Temporary Password <span className="text-red-400">*</span>
            </label>
            <input type="text" className={inputCls} placeholder="Temp@123" />
          </div>

          <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
            An invitation email will be sent to the seller with login instructions.
          </div>

          <button
            disabled
            className="w-full py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium opacity-60 cursor-default"
          >
            Create Seller
          </button>
        </div>
      </div>
    </div>
  );
}
