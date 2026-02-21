'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  ClipboardList,
  Image,
  LogOut,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Sellers', href: '/admin/sellers', icon: Users },
  { label: 'Products', href: '/admin/products', icon: ShoppingBag },
  { label: 'Orders', href: '/admin/orders', icon: ClipboardList },
  { label: 'Assets', href: '/admin/assets', icon: Image },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useToastStore((s) => s.add);

  async function handleLogout() {
    try {
      await logout();
      addToast('Logged out', 'info');
      router.push('/admin');
    } catch {
      router.push('/admin');
    }
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-card border-r border-border flex flex-col z-50">
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <Link href="/admin/dashboard" className="text-lg font-bold text-foreground flex items-center gap-2">
          <Shield size={18} className="text-amber-400" />
          PixEcom Admin
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-amber-500/10 text-amber-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User / Logout */}
      <div className="border-t border-border p-3">
        {user && (
          <div className="mb-2 px-1">
            <p className="text-sm font-medium text-foreground truncate">{user.displayName}</p>
            <p className="text-xs text-amber-400 truncate">Superadmin</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground
                     hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
