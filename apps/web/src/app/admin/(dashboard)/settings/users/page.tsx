'use client';

import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDate } from '@/lib/format';
import { useAdminApi } from '@/hooks/useAdminApi';
import { MOCK_ADMIN_USERS, type MockAdminUser } from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response type ───────────────────────────────────────────────────────

interface AdminUserApi {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isSuperadmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Unified row type
interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: 'bg-amber-500/15 text-amber-400',
  SUPPORT: 'bg-blue-500/15 text-blue-400',
  FINANCE: 'bg-purple-500/15 text-purple-400',
  CONTENT: 'bg-green-500/15 text-green-400',
};

export default function SettingsUsersPage() {
  const { data: apiUsers, loading, error } = useAdminApi<AdminUserApi[]>(
    IS_PREVIEW ? null : '/admin/users',
  );

  const users: UserRow[] = useMemo(() => {
    if (IS_PREVIEW) {
      return MOCK_ADMIN_USERS.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
      }));
    }
    if (!apiUsers) return [];
    return apiUsers.map((u) => ({
      id: u.id,
      name: u.displayName ?? u.email,
      email: u.email,
      role: u.role,
      status: u.isActive ? 'ACTIVE' : 'INACTIVE',
      lastLogin: '—',
      createdAt: u.createdAt,
    }));
  }, [apiUsers]);

  // Count by role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const columns: Column<UserRow>[] = [
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
      render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>,
    },
  ];

  if (!IS_PREVIEW && loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      icon={<Users size={20} className="text-amber-400" />}
      title="Admin Users"
      subtitle="Manage admin accounts, roles, and permissions"
      backHref="/admin/settings"
      backLabel="Settings"
      actions={
        <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors opacity-60 cursor-default">
          + Invite Admin
        </button>
      }
    >
      {!IS_PREVIEW && error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Role summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(['SUPERADMIN', 'CONTENT', 'SUPPORT', 'FINANCE'] as const).map((role) => (
          <div key={role} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground font-mono">
              {roleCounts[role] ?? 0}
            </p>
            <p className={`text-xs mt-1 font-medium ${ROLE_COLORS[role]?.split(' ')[1] ?? 'text-muted-foreground'}`}>
              {role}
            </p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={false}
        emptyMessage="No admin users found."
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
