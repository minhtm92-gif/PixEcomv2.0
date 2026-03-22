'use client';

import { useState, useEffect } from 'react';
import { Store } from 'lucide-react';
import { apiGet } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';

interface Seller {
  id: string;
  name: string;
  slug: string;
}

const STORAGE_KEY = 'superadmin_selected_seller';

/**
 * SellerSwitcher — dropdown for SUPERADMIN users to pick which seller's data to view.
 *
 * - Only renders for users with isSuperadmin === true
 * - Persists selection in localStorage
 * - Calls onSellerChange(sellerId) when changed
 */
export function SellerSwitcher({
  onSellerChange,
}: {
  onSellerChange: (sellerId: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Don't render for non-superadmin users
  const isSuperadmin = user?.isSuperadmin === true;

  // Fetch sellers list
  useEffect(() => {
    if (!isSuperadmin) return;

    (async () => {
      try {
        const list = await apiGet<Seller[]>('/admin/sellers/list-simple');
        setSellers(list);

        // Restore from localStorage or default to first seller
        const saved = localStorage.getItem(STORAGE_KEY);
        const match = list.find((s) => s.id === saved);
        const initial = match ? match.id : list[0]?.id ?? '';
        setSelectedId(initial);
        if (initial) {
          onSellerChange(initial);
        }
      } catch {
        // If the endpoint fails, dropdown stays empty
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  if (!isSuperadmin) return null;

  function handleChange(id: string) {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
    onSellerChange(id);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Store size={14} className="text-amber-400" />
        <div className="h-8 w-40 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (sellers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Store size={14} className="text-amber-400" />
        No sellers found
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Store size={14} className="text-amber-400 flex-shrink-0" />
      <select
        value={selectedId}
        onChange={(e) => handleChange(e.target.value)}
        className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm
                   text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50
                   cursor-pointer"
      >
        <option value="" disabled>
          Select seller...
        </option>
        {sellers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.slug})
          </option>
        ))}
      </select>
    </div>
  );
}
