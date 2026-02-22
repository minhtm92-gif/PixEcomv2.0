'use client';

import { FileText } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

export default function SettingsLegalPage() {
  return (
    <PageShell
      icon={<FileText size={20} className="text-amber-400" />}
      title="Legal"
      subtitle="Terms of service, privacy policy, and compliance documents"
    >
      <div className="max-w-2xl space-y-4">
        {[
          {
            title: 'Terms of Service',
            lastUpdated: '2025-12-01',
            status: 'Published',
            description: 'Governs the use of the PixEcom platform by all sellers and buyers.',
          },
          {
            title: 'Privacy Policy',
            lastUpdated: '2025-12-01',
            status: 'Published',
            description: 'Describes how we collect, use, and protect personal data.',
          },
          {
            title: 'Seller Agreement',
            lastUpdated: '2026-01-15',
            status: 'Published',
            description: 'Terms and conditions for sellers operating on the platform.',
          },
          {
            title: 'Cookie Policy',
            lastUpdated: '2025-11-01',
            status: 'Published',
            description: 'Explains what cookies we use and how users can control them.',
          },
          {
            title: 'GDPR Compliance Statement',
            lastUpdated: '2025-10-01',
            status: 'Draft',
            description: 'Compliance documentation for EU General Data Protection Regulation.',
          },
          {
            title: 'DMCA Policy',
            lastUpdated: '2025-09-01',
            status: 'Published',
            description: 'Procedures for reporting intellectual property violations.',
          },
        ].map((doc) => (
          <div
            key={doc.title}
            className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-foreground">{doc.title}</p>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    doc.status === 'Published'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {doc.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
              <p className="text-xs text-muted-foreground mt-1">Last updated: {doc.lastUpdated}</p>
            </div>
            <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0 opacity-60 cursor-default">
              Edit
            </button>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
