'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useAdminMutation } from '@/hooks/useAdminApi';
import { useToastStore } from '@/stores/toastStore';

const inputCls = 'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

export default function NewSellerPage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);
  const { mutate, loading } = useAdminMutation<{ seller: any }>('/admin/sellers', 'POST');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && email.trim() && password.trim().length >= 6 && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutate({ name: name.trim(), email: email.trim(), password: password.trim(), phone: phone.trim() || undefined });
      addToast('Seller created successfully!', 'success');
      router.push('/admin/sellers');
    } catch (err: any) {
      setError(err?.message || 'Failed to create seller');
    }
  }

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

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Store Name <span className="text-red-400">*</span>
            </label>
            <input type="text" className={inputCls} placeholder="My Awesome Store" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email <span className="text-red-400">*</span>
            </label>
            <input type="email" className={inputCls} placeholder="seller@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
            <input type="text" className={inputCls} placeholder="+84 912 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Temporary Password <span className="text-red-400">*</span>
            </label>
            <input type="text" className={inputCls} placeholder="Temp@123" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
            An invitation email will be sent to the seller with login instructions.
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Seller'}
          </button>
        </div>
      </form>
    </div>
  );
}
