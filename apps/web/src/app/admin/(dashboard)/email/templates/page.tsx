'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit3,
  Eye,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { StatusBadge } from '@/components/StatusBadge';
import { useAdminApi } from '@/hooks/useAdminApi';
import { api, apiPost, apiDelete } from '@/lib/apiClient';
import { useToastStore, toastApiError } from '@/stores/toastStore';

// ── Types ───────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  storeId: string;
  flowId: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

interface TemplatesResponse {
  data: EmailTemplate[];
  total: number;
}

const FLOW_OPTIONS = [
  { value: 'order_confirmation', label: 'Order Confirmation' },
  { value: 'order_shipped', label: 'Order Shipped' },
  { value: 'order_delivered', label: 'Order Delivered' },
  { value: 'cart_recovery_1', label: 'Cart Recovery #1' },
  { value: 'cart_recovery_2', label: 'Cart Recovery #2' },
  { value: 'cart_recovery_3', label: 'Cart Recovery #3' },
  { value: 'welcome', label: 'Welcome Email' },
  { value: 'win_back', label: 'Win-Back' },
  { value: 'review_request', label: 'Review Request' },
  { value: 'refund_confirmation', label: 'Refund Confirmation' },
];

const VARIABLE_HINTS: Record<string, string[]> = {
  order_confirmation: ['{{customerName}}', '{{orderNumber}}', '{{orderTotal}}', '{{orderItems}}', '{{trackingUrl}}'],
  order_shipped: ['{{customerName}}', '{{orderNumber}}', '{{trackingNumber}}', '{{trackingUrl}}', '{{carrierName}}'],
  order_delivered: ['{{customerName}}', '{{orderNumber}}', '{{deliveryDate}}'],
  cart_recovery_1: ['{{customerName}}', '{{cartItems}}', '{{cartTotal}}', '{{recoveryUrl}}', '{{discountCode}}'],
  cart_recovery_2: ['{{customerName}}', '{{cartItems}}', '{{cartTotal}}', '{{recoveryUrl}}', '{{discountCode}}'],
  cart_recovery_3: ['{{customerName}}', '{{cartItems}}', '{{cartTotal}}', '{{recoveryUrl}}', '{{discountCode}}'],
  welcome: ['{{customerName}}', '{{storeName}}'],
  win_back: ['{{customerName}}', '{{lastOrderDate}}', '{{discountCode}}'],
  review_request: ['{{customerName}}', '{{productName}}', '{{reviewUrl}}'],
  refund_confirmation: ['{{customerName}}', '{{orderNumber}}', '{{refundAmount}}'],
};

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getFlowLabel(flowId: string): string {
  return FLOW_OPTIONS.find((f) => f.value === flowId)?.label ?? flowId;
}

// ── Template Form Modal ─────────────────────────────────────────────────────

interface TemplateFormProps {
  template: EmailTemplate | null; // null = create new
  onClose: () => void;
  onSaved: () => void;
}

function TemplateFormModal({ template, onClose, onSaved }: TemplateFormProps) {
  const addToast = useToastStore((s) => s.add);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    flowId: template?.flowId ?? '',
    name: template?.name ?? '',
    subject: template?.subject ?? '',
    htmlBody: template?.htmlBody ?? '',
    textBody: template?.textBody ?? '',
    isActive: template?.isActive ?? true,
  });

  const hints = VARIABLE_HINTS[form.flowId] ?? [];

  async function handleSave() {
    if (!form.flowId || !form.name || !form.subject) {
      addToast('Please fill in Flow, Name, and Subject fields', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (template) {
        // Update
        await api(`/email-templates/${template.id}`, { method: 'PUT', body: form });
        addToast('Template updated', 'success');
      } else {
        // Create
        await apiPost('/email-templates', form);
        addToast('Template created', 'success');
      }
      onSaved();
    } catch (err) {
      toastApiError(err as { code?: string; message?: string; status?: number });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {template ? 'Edit Template' : 'Create Template'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Flow selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Flow *
            </label>
            <select
              value={form.flowId}
              onChange={(e) => setForm({ ...form, flowId: e.target.value })}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
            >
              <option value="">Select a flow...</option>
              {FLOW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Template Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Cart Recovery - Urgent Reminder"
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Subject *
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g., You left something behind, {{customerName}}!"
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
            />
            {hints.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Available variables: {hints.join(', ')}
              </p>
            )}
          </div>

          {/* HTML Body */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              HTML Body
            </label>
            <textarea
              value={form.htmlBody}
              onChange={(e) => setForm({ ...form, htmlBody: e.target.value })}
              rows={10}
              placeholder="<html><body>Your email HTML here...</body></html>"
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors resize-y"
            />
          </div>

          {/* Text Body */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Plain Text Body
            </label>
            <textarea
              value={form.textBody}
              onChange={(e) => setForm({ ...form, textBody: e.target.value })}
              rows={4}
              placeholder="Plain text fallback for email clients that don't support HTML"
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors resize-y"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {form.isActive ? (
                <ToggleRight size={28} className="text-green-400" />
              ) : (
                <ToggleLeft size={28} />
              )}
            </button>
            <span className="text-sm text-foreground">
              {form.isActive ? 'Active — emails will be sent' : 'Inactive — emails paused'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-card border border-border text-foreground font-medium rounded-lg text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {template ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preview Modal ───────────────────────────────────────────────────────────

interface PreviewModalProps {
  templateId: string;
  templateName: string;
  onClose: () => void;
}

function PreviewModal({ templateId, templateName, onClose }: PreviewModalProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPreview() {
      try {
        setLoading(true);
        const result = await apiPost<{ html: string }>(`/email-templates/${templateId}/preview`);
        if (!cancelled) setHtml(result.html);
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as { message?: string };
          setError(apiErr.message ?? 'Failed to load preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPreview();
    return () => { cancelled = true; };
  }, [templateId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Preview: {templateName}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Rendering preview...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="p-6">
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-center">
                {error}
              </div>
            </div>
          )}
          {html && (
            <iframe
              srcDoc={html}
              title="Email Preview"
              className="w-full h-full min-h-[500px] border-0 bg-white"
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  const addToast = useToastStore((s) => s.add);
  const { data: templatesData, loading, error, refetch } = useAdminApi<TemplatesResponse | EmailTemplate[]>('/email-templates');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null | 'new'>(null);
  const [previewTemplate, setPreviewTemplate] = useState<{ id: string; name: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Normalize response
  const templates: EmailTemplate[] = Array.isArray(templatesData)
    ? templatesData
    : templatesData?.data ?? [];

  async function handleToggleActive(template: EmailTemplate) {
    setTogglingId(template.id);
    try {
      await api(`/email-templates/${template.id}`, {
        method: 'PUT',
        body: { isActive: !template.isActive },
      });
      addToast(`Template ${template.isActive ? 'deactivated' : 'activated'}`, 'success');
      refetch();
    } catch (err) {
      toastApiError(err as { code?: string; message?: string; status?: number });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(template: EmailTemplate) {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/email-templates/${template.id}`);
      addToast('Template deleted', 'success');
      refetch();
    } catch (err) {
      toastApiError(err as { code?: string; message?: string; status?: number });
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      icon={<FileText size={20} className="text-amber-400" />}
      title="Email Templates"
      subtitle="Manage email templates for all flows"
      backHref="/admin/email"
      backLabel="Email Marketing"
      actions={
        <button
          onClick={() => setEditingTemplate('new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg text-sm hover:bg-amber-600 transition-colors"
        >
          <Plus size={16} />
          Create Template
        </button>
      }
    >
      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Template Grid */}
      {templates.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <FileText size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No email templates yet</p>
          <button
            onClick={() => setEditingTemplate('new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg text-sm hover:bg-amber-600 transition-colors"
          >
            <Plus size={16} />
            Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-amber-500/30 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tpl.name}</p>
                  <p className="text-xs text-amber-400 mt-0.5">{getFlowLabel(tpl.flowId)}</p>
                </div>
                <StatusBadge status={tpl.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>

              {/* Subject */}
              <p className="text-xs text-muted-foreground truncate mb-3" title={tpl.subject}>
                Subject: {tpl.subject}
              </p>

              {/* Updated */}
              <p className="text-xs text-muted-foreground mb-4">
                Updated {timeAgo(tpl.updatedAt)}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <button
                  onClick={() => setEditingTemplate(tpl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Edit3 size={13} />
                  Edit
                </button>
                <button
                  onClick={() => setPreviewTemplate({ id: tpl.id, name: tpl.name })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Eye size={13} />
                  Preview
                </button>
                <button
                  onClick={() => handleToggleActive(tpl)}
                  disabled={togglingId === tpl.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {togglingId === tpl.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : tpl.isActive ? (
                    <ToggleRight size={13} className="text-green-400" />
                  ) : (
                    <ToggleLeft size={13} />
                  )}
                  {tpl.isActive ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => handleDelete(tpl)}
                  className="ml-auto px-3 py-1.5 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editingTemplate !== null && (
        <TemplateFormModal
          template={editingTemplate === 'new' ? null : editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => {
            setEditingTemplate(null);
            refetch();
          }}
        />
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <PreviewModal
          templateId={previewTemplate.id}
          templateName={previewTemplate.name}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </PageShell>
  );
}
