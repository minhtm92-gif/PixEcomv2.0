'use client';

import { useState, useEffect } from 'react';
import { FileText, Save, X, Loader2, ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { useAdminApi, useAdminMutation } from '@/hooks/useAdminApi';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

interface LegalDoc {
  slug: string;
  title: string;
  description: string;
  status: 'Published' | 'Draft';
  content: string;
  lastUpdated: string;
}

const DEFAULT_DOCS: LegalDoc[] = [
  { slug: 'shipping', title: 'Shipping Policy', description: 'Shipping methods, delivery times, and costs for all orders.', status: 'Published', content: '', lastUpdated: new Date().toISOString().slice(0, 10) },
  { slug: 'returns', title: 'Returns & Exchanges', description: 'Return and exchange policies for purchased products.', status: 'Published', content: '', lastUpdated: new Date().toISOString().slice(0, 10) },
  { slug: 'terms', title: 'Terms of Service', description: 'Governs the use of the PixEcom platform by all sellers and buyers.', status: 'Published', content: '', lastUpdated: new Date().toISOString().slice(0, 10) },
  { slug: 'privacy', title: 'Privacy Policy', description: 'Describes how we collect, use, and protect personal data.', status: 'Published', content: '', lastUpdated: new Date().toISOString().slice(0, 10) },
  { slug: 'seller-agreement', title: 'Seller Agreement', description: 'Terms and conditions for sellers operating on the platform.', status: 'Published', content: '', lastUpdated: new Date().toISOString().slice(0, 10) },
  { slug: 'cookie-policy', title: 'Cookie Policy', description: 'Explains what cookies we use and how users can control them.', status: 'Published', content: '', lastUpdated: new Date().toISOString().slice(0, 10) },
  { slug: 'gdpr', title: 'GDPR Compliance Statement', description: 'Compliance documentation for EU General Data Protection Regulation.', status: 'Draft', content: '', lastUpdated: new Date().toISOString().slice(0, 10) },
  { slug: 'dmca', title: 'DMCA Policy', description: 'Procedures for reporting intellectual property violations.', status: 'Published', content: '', lastUpdated: new Date().toISOString().slice(0, 10) },
];

interface PlatformSettings {
  legalPages?: Record<string, LegalDoc>;
}

export default function SettingsLegalPage() {
  const { data: apiSettings, loading } = useAdminApi<PlatformSettings>(
    IS_PREVIEW ? null : '/admin/settings',
  );
  const { mutate: save, loading: saving } = useAdminMutation<PlatformSettings>(
    '/admin/settings',
    'PATCH',
  );

  const [docs, setDocs] = useState<LegalDoc[]>(DEFAULT_DOCS);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', status: 'Published' as 'Published' | 'Draft' });
  const [saved, setSaved] = useState(false);

  // Load docs from API
  useEffect(() => {
    if (apiSettings?.legalPages) {
      const pages = apiSettings.legalPages;
      setDocs(prev =>
        prev.map(doc => {
          const apiDoc = pages[doc.slug];
          return apiDoc ? { ...doc, ...apiDoc } : doc;
        }),
      );
    }
  }, [apiSettings]);

  function startEdit(slug: string) {
    const doc = docs.find(d => d.slug === slug);
    if (!doc) return;
    setEditForm({ title: doc.title, content: doc.content, status: doc.status });
    setEditing(slug);
    setSaved(false);
  }

  async function handleSave() {
    if (!editing) return;
    const now = new Date().toISOString().slice(0, 10);
    const updatedDoc: LegalDoc = {
      ...docs.find(d => d.slug === editing)!,
      title: editForm.title,
      content: editForm.content,
      status: editForm.status,
      lastUpdated: now,
    };

    // Update local state
    setDocs(prev => prev.map(d => (d.slug === editing ? updatedDoc : d)));

    // Save to backend
    const legalPages: Record<string, LegalDoc> = {};
    docs.forEach(d => {
      legalPages[d.slug] = d.slug === editing ? updatedDoc : d;
    });

    if (!IS_PREVIEW) {
      await save({ legalPages });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Edit view ──
  if (editing) {
    const doc = docs.find(d => d.slug === editing);
    return (
      <PageShell
        icon={<FileText size={20} className="text-amber-400" />}
        title={`Edit: ${doc?.title}`}
        subtitle="Update the content and publish status"
        backHref="/admin/settings/legal"
        backLabel="Legal"
      >
        <div className="max-w-3xl space-y-5">
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back to all documents
          </button>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
            <input
              type="text"
              value={editForm.title}
              onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={editForm.status}
              onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as 'Published' | 'Draft' }))}
              className={inputCls}
            >
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Content <span className="text-muted-foreground/60">(HTML supported)</span>
            </label>
            <textarea
              value={editForm.content}
              onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
              rows={20}
              className={`${inputCls} font-mono text-xs leading-relaxed resize-y`}
              placeholder="Enter the legal document content here. HTML tags are supported for formatting."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-black font-medium text-sm rounded-lg transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-foreground text-sm rounded-lg transition-colors"
            >
              <X size={14} /> Cancel
            </button>
            {saved && (
              <span className="text-xs text-green-400 font-medium">Saved successfully!</span>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  // ── List view ──
  return (
    <PageShell
      icon={<FileText size={20} className="text-amber-400" />}
      title="Legal"
      subtitle="Terms of service, privacy policy, and compliance documents"
      backHref="/admin/settings"
      backLabel="Settings"
    >
      <div className="max-w-2xl space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading...
          </div>
        )}
        {docs.map((doc) => (
          <div
            key={doc.slug}
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
            <button
              onClick={() => startEdit(doc.slug)}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0 font-medium"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
