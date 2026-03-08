'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileDrawer } from '@/components/MobileDrawer';
import { NAV } from '@/components/Sidebar';

export function PortalMobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const seller = useAuthStore((s) => s.seller);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useToastStore((s) => s.add);

  async function handleLogout() {
    try {
      await logout();
      addToast('Logged out', 'info');
      router.push('/login');
    } catch {
      router.push('/login');
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
        <span className="flex-1 text-center text-sm font-bold text-foreground">
          PixEcom <span className="text-xs font-normal text-muted-foreground">v2</span>
        </span>
        <ThemeToggle />
      </div>

      {/* Drawer */}
      <MobileDrawer open={open} onClose={() => setOpen(false)}>
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <span className="text-lg font-bold text-foreground">
            PixEcom <span className="text-xs font-normal text-muted-foreground">v2</span>
          </span>
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
                    ? 'bg-primary/10 text-primary font-medium'
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
        <div className="border-t border-sidebar-border p-3">
          {user && (
            <div className="mb-2 px-1">
              <p className="text-sm font-medium text-foreground truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{seller?.name ?? user.email}</p>
            </div>
          )}
          <button
            onClick={() => { setOpen(false); handleLogout(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground
                       hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </MobileDrawer>
    </>
  );
}
