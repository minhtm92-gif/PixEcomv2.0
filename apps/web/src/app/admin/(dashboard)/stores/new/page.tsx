'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { MOCK_SELLERS } from '@/mock/admin';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

export default function NewStorePage() {
  const [verificationMethod, setVerificationMethod] = useState<'TXT' | 'A_RECORD'>('TXT');

  return (
    <PageShell
      icon={<Globe size={20} className="text-amber-400" />}
      backHref="/admin/stores"
      backLabel="Stores"
      title="Add New Store"
      actions={
        <>
          <button className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
            Cancel
          </button>
          <button
            disabled
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium opacity-60 cursor-default"
          >
            Create Store
          </button>
        </>
      }
    >
      <div className="bg-card rounded-xl border border-border p-6 max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Top-level Domain <span className="text-red-400">*</span>
            </label>
            <input type="text" className={inputCls} placeholder="bestbra.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Assign to Seller <span className="text-red-400">*</span>
            </label>
            <select className={inputCls} defaultValue="">
              <option value="" disabled>
                Select a seller...
              </option>
              {MOCK_SELLERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Verification Method
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="verification"
                  value="TXT"
                  checked={verificationMethod === 'TXT'}
                  onChange={() => setVerificationMethod('TXT')}
                  className="accent-amber-500"
                />
                TXT Record
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="verification"
                  value="A_RECORD"
                  checked={verificationMethod === 'A_RECORD'}
                  onChange={() => setVerificationMethod('A_RECORD')}
                  className="accent-amber-500"
                />
                A Record
              </label>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
            After creating the store, the seller will need to add a DNS record to verify domain
            ownership.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
