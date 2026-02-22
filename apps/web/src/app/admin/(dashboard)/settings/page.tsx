'use client';

import Link from 'next/link';
import {
  Settings,
  Globe,
  CreditCard,
  Mail,
  Truck,
  Tag,
  Users,
  FileText,
  MessageSquare,
  Receipt,
  Puzzle,
  ChevronRight,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const SETTING_GROUPS = [
  {
    group: 'Platform',
    items: [
      {
        href: '/admin/settings/general',
        icon: Globe,
        label: 'General',
        description: 'Platform name, timezone, language, and branding',
      },
      {
        href: '/admin/settings/billing',
        icon: Receipt,
        label: 'Billing & Plans',
        description: 'Subscription plans, seller fees, and invoicing',
      },
    ],
  },
  {
    group: 'Payments & Fulfillment',
    items: [
      {
        href: '/admin/settings/payments',
        icon: CreditCard,
        label: 'Payment Gateways',
        description: 'Configure Stripe and PayPal integration keys',
      },
      {
        href: '/admin/settings/fulfillment',
        icon: Truck,
        label: 'Fulfillment',
        description: 'Shipping carriers, warehouses, and fulfillment rules',
      },
    ],
  },
  {
    group: 'Marketing',
    items: [
      {
        href: '/admin/settings/discounts',
        icon: Tag,
        label: 'Discounts & Coupons',
        description: 'Manage platform-wide discount codes and rules',
      },
      {
        href: '/admin/settings/email',
        icon: Mail,
        label: 'Email',
        description: 'Transactional email provider, templates, and sender info',
      },
      {
        href: '/admin/settings/sms',
        icon: MessageSquare,
        label: 'SMS',
        description: 'SMS gateway, opt-in flows, and notification templates',
      },
    ],
  },
  {
    group: 'Admin & Legal',
    items: [
      {
        href: '/admin/settings/users',
        icon: Users,
        label: 'Admin Users',
        description: 'Manage admin accounts, roles, and permissions',
      },
      {
        href: '/admin/settings/legal',
        icon: FileText,
        label: 'Legal',
        description: 'Terms of service, privacy policy, and compliance docs',
      },
      {
        href: '/admin/settings/apps',
        icon: Puzzle,
        label: 'Apps & Integrations',
        description: 'Third-party app connections and webhook endpoints',
      },
    ],
  },
];

export default function AdminSettingsHubPage() {
  return (
    <PageShell
      icon={<Settings size={20} className="text-amber-400" />}
      title="Settings"
      subtitle="Platform configuration and administration"
    >
      <div className="space-y-8">
        {SETTING_GROUPS.map((group) => (
          <div key={group.group}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {group.group}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-amber-500/40 hover:bg-muted/20 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <item.icon size={18} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-muted-foreground/40 group-hover:text-amber-400 transition-colors flex-shrink-0"
                  />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
