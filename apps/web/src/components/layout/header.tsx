'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Search, Bell } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ads-manager': 'Ads Manager',
  '/sellpages': 'Sellpages',
  '/orders': 'Orders',
  '/products': 'Products',
  '/assets': 'Assets',
  '/creatives': 'Creatives',
  '/settings': 'Settings',
};

export function Header() {
  const pathname = usePathname();
  const pageTitle = BREADCRUMB_MAP[pathname] || 'Dashboard';

  return (
    <header
      className={cn(
        'header fixed top-0 right-0 z-10 flex items-stretch shrink-0 bg-background border-b border-border',
      )}
    >
      <div className="container-fluid flex justify-between items-center lg:px-8 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Home</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium">{pageTitle}</span>
        </div>

        {/* Topbar */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
            <Search className="h-4 w-4" />
          </button>

          {/* Notifications */}
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
            <Bell className="h-4 w-4" />
          </button>

          {/* User */}
          <div className="ml-1">
            <Avatar
              fallback="Demo User"
              size="sm"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
