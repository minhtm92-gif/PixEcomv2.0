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
  Globe,
  BarChart3,
  Settings,
  LogOut,
  Shield,
  ExternalLink,
  FileText,
  Palette,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ThemeToggle';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

/** Full admin navigation */
const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Sellers', href: '/admin/sellers', icon: Users },
  { label: 'Orders', href: '/admin/orders', icon: ClipboardList },
  { label: 'Products', href: '/admin/products', icon: ShoppingBag },
  { label: 'Stores', href: '/admin/stores', icon: Globe },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

/** Content role: restricted navigation (FB-20) */
const CONTENT_NAV = [
  { label: 'Products', href: '/admin/products', icon: ShoppingBag },
  { label: 'Sellpages', href: '/admin/sellpages', icon: FileText },
  { label: 'Creatives', href: '/admin/creatives', icon: Palette },
  { label: 'Performance', href: '/admin/content-performance', icon: TrendingUp },
];

// Toggle this to preview Content role nav (preview-only)
const PREVIEW_AS_CONTENT = false;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useToastStore((s) => s.add);

  const isContentRole = PREVIEW_AS_CONTENT; // In real mode: derived from JWT role
  const NAV = isContentRole ? CONTENT_NAV : ADMIN_NAV;

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
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Brand */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
        <Link href={isContentRole ? '/admin/products' : '/admin/dashboard'} className="text-lg font-bold text-foreground flex items-center gap-2">
          <Shield size={18} className="text-amber-400" />
          {isContentRole ? 'Content' : 'Admin'}
          {IS_PREVIEW && (
            <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded uppercase">
              Preview
            </span>
          )}
        </Link>
        <ThemeToggle />
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

        {/* Storefront cross-link (preview only) */}
        {IS_PREVIEW && (
          <>
            <div className="h-px bg-border my-2" />
            <a
              href="/demo-store"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink size={18} />
              Storefront ↗
            </a>
            <a
              href="/preview"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink size={16} />
              ← Preview Hub
            </a>
          </>
        )}
      </nav>

      {/* User / Logout */}
      <div className="border-t border-sidebar-border p-3">
        {IS_PREVIEW ? (
          <div className="mb-2 px-1">
            <p className="text-sm font-medium text-foreground">Preview Mode</p>
            <p className="text-xs text-amber-400">{isContentRole ? 'Content Role' : 'No auth required'}</p>
          </div>
        ) : (
          user && (
            <div className="mb-2 px-1">
              <p className="text-sm font-medium text-foreground truncate">{user.displayName}</p>
              <p className="text-xs text-amber-400 truncate">{isContentRole ? 'Content' : 'Superadmin'}</p>
            </div>
          )
        )}
        {!IS_PREVIEW && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground
                       hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
