'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Megaphone,
  ShoppingCart,
  FileText,
  Package,
  ImageIcon,
  Palette,
  Settings,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: '',
    items: [
      { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'ADS MANAGER',
    items: [
      { title: 'Campaigns', path: '/ads-manager', icon: Megaphone },
    ],
  },
  {
    label: 'COMMERCE',
    items: [
      { title: 'Sellpages', path: '/sellpages', icon: FileText },
      { title: 'Orders', path: '/orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { title: 'Products', path: '/products', icon: Package },
      { title: 'Assets', path: '/assets', icon: ImageIcon },
      { title: 'Creatives', path: '/creatives', icon: Palette },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { title: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

export function SidebarMenu() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  return (
    <nav className="flex flex-col gap-1 py-4 px-4 overflow-y-auto flex-1">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.label && (
            <div className="sidebar-label px-3 pt-4 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="sidebar-menu-title">{item.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
