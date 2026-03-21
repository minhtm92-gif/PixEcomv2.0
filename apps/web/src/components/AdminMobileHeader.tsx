'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Shield, LogOut, ExternalLink, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileDrawer } from '@/components/MobileDrawer';
import { ADMIN_NAV, CONTENT_NAV } from '@/components/AdminSidebar';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
const PREVIEW_AS_CONTENT = false;

export function AdminMobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useToastStore((s) => s.add);

  const isContentRole = PREVIEW_AS_CONTENT;
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
    <>
      {/* Fixed top bar — visible only on mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-30">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="flex-1 text-center text-sm font-bold text-foreground flex items-center justify-center gap-1.5">
          <Shield size={16} className="text-amber-400" />
          {isContentRole ? 'Content' : 'Admin'}
          {IS_PREVIEW && (
            <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded uppercase">
              Preview
            </span>
          )}
        </span>
        <ThemeToggle />
      </div>

      {/* Drawer */}
      <MobileDrawer open={open} onClose={() => setOpen(false)}>
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <Link
            href={isContentRole ? '/admin/products' : '/admin/dashboard'}
            onClick={() => setOpen(false)}
            className="text-lg font-bold text-foreground flex items-center gap-2"
          >
            <Shield size={18} className="text-amber-400" />
            {isContentRole ? 'Content' : 'Admin'}
            {IS_PREVIEW && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded uppercase">
                Preview
              </span>
            )}
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
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
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink size={18} />
                Storefront
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
            <>
              <Link
                href="/orders"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-400
                           hover:bg-amber-500/10 transition-colors mb-0.5"
              >
                <ArrowRightLeft size={16} />
                Seller Portal
              </Link>
              <button
                onClick={() => { setOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground
                           hover:text-foreground hover:bg-muted transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </>
          )}
        </div>
      </MobileDrawer>
    </>
  );
}
