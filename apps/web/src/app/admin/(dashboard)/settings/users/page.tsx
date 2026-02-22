'use client';

import { Users } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { MOCK_ADMIN_USERS, type MockAdminUser } from '@/mock/admin';

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: 'bg-amber-500/15 text-amber-400',
  SUPPORT: 'bg-blue-500/15 text-blue-400',
  FINANCE: 'bg-purple-500/15 text-purple-400',
};

export default function SettingsUsersPage() {
  const columns: Column<MockAdminUser>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[r.role] ?? 'bg-muted text-muted-foreground'}`}
        >
          {r.role}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      className: 'text-right',
      render: (r) => <span className="text-xs text-muted-foreground">{r.lastLogin}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      className: 'text-right',
      render: (r) => <span className="text-xs text-muted-foreground">{r.createdAt}</span>,
    },
  ];

  return (
    <PageShell
      icon={<Users size={20} className="text-amber-400" />}
      title="Admin Users"
      subtitle="Manage admin accounts, roles, and permissions"
      actions={
        <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors opacity-60 cursor-default">
          + Invite Admin (Preview)
        </button>
      }
    >
      {/* Role summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['SUPERADMIN', 'SUPPORT', 'FINANCE'] as const).map((role) => (
          <div key={role} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-mono">
              {MOCK_ADMIN_USERS.filter((u) => u.role === role).length}
            </p>
            <p className={`text-xs mt-1 font-medium ${ROLE_COLORS[role]?.split(' ')[1] ?? 'text-muted-foreground'}`}>
              {role}
            </p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={MOCK_ADMIN_USERS}
        loading={false}
        emptyMessage="No admin users found."
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
