'use client';

import { Shield, Users, ClipboardList, DollarSign } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield size={22} className="text-amber-400" />
          Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform overview and administration
        </p>
      </div>

      {/* Placeholder KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Users size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Sellers</p>
              <p className="text-2xl font-bold text-foreground">—</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Coming soon</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ClipboardList size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Orders</p>
              <p className="text-2xl font-bold text-foreground">—</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Coming soon</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <DollarSign size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-bold text-foreground">—</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Coming soon</p>
        </div>
      </div>

      {/* Coming soon message */}
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
          <Shield size={32} className="text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Coming soon</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Admin features will be added here — seller management, product moderation, order oversight, and platform analytics.
        </p>
      </div>
    </div>
  );
}
