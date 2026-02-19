'use client';

import Link from 'next/link';
import { SidebarMenu } from './sidebar-menu';

export function Sidebar() {
  return (
    <div className="sidebar fixed top-0 bottom-0 left-0 z-20 hidden lg:flex flex-col border-r border-border bg-card">
      {/* Sidebar Header */}
      <div className="sidebar-header flex items-center px-6 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            P
          </div>
          <span className="sidebar-menu-title text-base font-semibold text-foreground">
            PixEcom
          </span>
        </Link>
      </div>

      {/* Sidebar Menu */}
      <div className="sidebar-wrapper overflow-hidden flex-1">
        <SidebarMenu />
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-label px-6 py-3 border-t border-border">
        <p className="text-2xs text-muted-foreground/50">Seller Portal v2</p>
      </div>
    </div>
  );
}
