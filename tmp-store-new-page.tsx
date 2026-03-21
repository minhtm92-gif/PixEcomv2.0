'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { useAdminApi, useAdminMutation } from '@/hooks/useAdminApi';
import { useToastStore } from '@/stores/toastStore';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

interface SellerRow {
  id: string;
  name: string;
  email: string;
}

export default function NewStorePage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const { data: sellersData } = useAdminApi<{ sellers: SellerRow[] }>('/admin/sellers?limit=100');
  const { mutate, loading } = useAdminMutation<any>('/admin/stores', 'POST');

  const [hostname, setHostname] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'TXT' | 'A_RECORD'>('TXT');
  const [error, setError] = useState<string | null>(null);

  const sellers = sellersData?.sellers ?? [];
  const canSubmit = hostname.trim() && sellerId && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutate({ sellerId, hostname: hostname.trim(), verificationMethod });
      addToast('Store created successfully!', 'success');
      router.push('/admin/stores');
    } catch (err: any) {
      setError(err?.message || 'Failed to create store');
    }
  }

  return (
    <PageShell
      icon={<Globe size={20} className="text-amber-400" />}
      backHref="/admin/stores"
      backLabel="Stores"
      title="Add New Store"
      actions={
        <>
          <button
            type="button"
            onClick={() => router.push('/admin/stores')}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-store-form"
            disabled={!canSubmit}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Store'}
          </button>
        </>
      }
    >
      <form id="create-store-form" onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Top-level Domain <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder="bestbra.com"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Assign to Seller <span className="text-red-400">*</span>
            </label>
            <select
              className={inputCls}
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select a seller...
              </option>
              {sellers.map((s) => (
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

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </form>
    </PageShell>
  );
}
