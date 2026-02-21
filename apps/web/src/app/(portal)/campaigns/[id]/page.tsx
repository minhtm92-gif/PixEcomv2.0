'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Pencil,
  X,
  Save,
  Loader2,
  Rocket,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { fmtDate } from '@/lib/format';
import type {
  CampaignDetail,
  UpdateCampaignDto,
  BudgetType,
} from '@/types/api';
import { isDraftCampaign } from '@/types/api';

// ── Status helpers ──
type DisplayStatus = 'draft' | 'active' | 'paused' | 'archived';

function getDisplayStatus(c: Pick<CampaignDetail, 'status' | 'externalCampaignId'>): DisplayStatus {
  if (c.status === 'ARCHIVED') return 'archived';
  if (c.status === 'ACTIVE') return 'active';
  if (isDraftCampaign(c)) return 'draft';
  return 'paused';
}

const STATUS_CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border border-border' },
  active: { label: 'Active', className: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  paused: { label: 'Paused', className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  archived: { label: 'Archived', className: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};

function CampaignStatusBadge({ campaign }: { campaign: Pick<CampaignDetail, 'status' | 'externalCampaignId'> }) {
  const ds = getDisplayStatus(campaign);
  const cfg = STATUS_CONFIG[ds];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── Confirmation dialog ──
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClassName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmDialog({ title, message, confirmLabel, confirmClassName, onConfirm, onCancel, loading }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => !loading && onCancel()} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-sm mx-4 shadow-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 ${confirmClassName}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

// ── Main Page ─────────────────────────────────────────────────────────
export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Edit mode ──
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editBudgetType, setEditBudgetType] = useState<BudgetType>('DAILY');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  // ── Action states ──
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'launch' | 'pause' | 'resume' | null>(null);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<CampaignDetail>(`/campaigns/${id}`);
      setCampaign(data);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load campaign');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  function startEditing() {
    if (!campaign) return;
    setEditName(campaign.name);
    setEditBudget(campaign.budgetPerDay != null ? String(campaign.budgetPerDay) : '');
    setEditBudgetType(campaign.budgetType);
    setEditStartDate(campaign.startDate ? campaign.startDate.slice(0, 10) : '');
    setEditEndDate(campaign.endDate ? campaign.endDate.slice(0, 10) : '');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!campaign || !editName.trim()) return;
    setSaving(true);
    try {
      const body: UpdateCampaignDto = {};
      if (editName.trim() !== campaign.name) body.name = editName.trim();
      const newBudget = editBudget ? Number(editBudget) : undefined;
      if (newBudget !== undefined && newBudget !== (campaign.budgetPerDay ?? undefined)) body.budget = newBudget;
      if (editBudgetType !== campaign.budgetType) body.budgetType = editBudgetType;
      const newStart = editStartDate || null;
      const oldStart = campaign.startDate ? campaign.startDate.slice(0, 10) : null;
      if (newStart !== oldStart) body.startDate = newStart ?? undefined;
      const newEnd = editEndDate || null;
      const oldEnd = campaign.endDate ? campaign.endDate.slice(0, 10) : null;
      if (newEnd !== oldEnd) body.endDate = newEnd ?? undefined;

      const updated = await apiPatch<CampaignDetail>(`/campaigns/${campaign.id}`, body);
      setCampaign(updated);
      setEditing(false);
      addToast('Campaign updated', 'success');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  async function executeAction(action: 'launch' | 'pause' | 'resume') {
    if (!campaign) return;
    setActionLoading(true);
    setConfirmAction(null);
    try {
      let updated: CampaignDetail;
      if (action === 'launch') {
        updated = await apiPost<CampaignDetail>(`/campaigns/${campaign.id}/launch`, {});
        addToast('Campaign launched', 'success');
      } else if (action === 'pause') {
        updated = await apiPatch<CampaignDetail>(`/campaigns/${campaign.id}/pause`, {});
        addToast('Campaign paused', 'success');
      } else {
        updated = await apiPatch<CampaignDetail>(`/campaigns/${campaign.id}/resume`, {});
        addToast('Campaign resumed', 'success');
      }
      setCampaign(updated);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error ?? 'Campaign not found'}
        </div>
      </div>
    );
  }

  const ds = getDisplayStatus(campaign);
  const isDraft = ds === 'draft';
  const isActive = ds === 'active';
  const isPaused = ds === 'paused'; // launched but paused

  const CONFIRM_CONFIG = {
    launch: {
      title: 'Launch Campaign?',
      message: `This will publish "${campaign.name}" to Facebook Ads and start delivery.`,
      confirmLabel: 'Launch',
      confirmClassName: 'bg-green-600 hover:bg-green-500',
    },
    pause: {
      title: 'Pause Campaign?',
      message: `This will pause delivery for "${campaign.name}".`,
      confirmLabel: 'Pause',
      confirmClassName: 'bg-yellow-600 hover:bg-yellow-500',
    },
    resume: {
      title: 'Resume Campaign?',
      message: `This will resume delivery for "${campaign.name}".`,
      confirmLabel: 'Resume',
      confirmClassName: 'bg-green-600 hover:bg-green-500',
    },
  };

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => router.push('/campaigns')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Back to Campaigns
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground truncate">{campaign.name}</h1>
            <CampaignStatusBadge campaign={campaign} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">ID: {campaign.id}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Action buttons based on status */}
          {isDraft && (
            <button
              onClick={() => setConfirmAction('launch')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium
                         hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Launch Campaign
            </button>
          )}

          {isActive && (
            <button
              onClick={() => setConfirmAction('pause')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm font-medium
                         hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
              Pause
            </button>
          )}

          {isPaused && (
            <button
              onClick={() => setConfirmAction('resume')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium
                         hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
              Resume
            </button>
          )}

          {/* Edit toggle */}
          {!editing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium
                         hover:text-foreground transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
          ) : (
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium
                         hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Edit form ── */}
      {editing && (
        <form onSubmit={handleSave} className="bg-card border border-primary/20 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Edit Campaign</h2>

          <div>
            <label htmlFor="edit-name" className="block text-sm text-muted-foreground mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className={inputCls}
              placeholder="Campaign name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-budget" className="block text-sm text-muted-foreground mb-1.5">
                Budget
              </label>
              <input
                id="edit-budget"
                type="number"
                min="1"
                step="0.01"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
                className={inputCls}
                placeholder="50"
              />
            </div>
            <div>
              <label htmlFor="edit-budget-type" className="block text-sm text-muted-foreground mb-1.5">
                Budget Type
              </label>
              <select
                id="edit-budget-type"
                value={editBudgetType}
                onChange={(e) => setEditBudgetType(e.target.value as BudgetType)}
                className={inputCls}
              >
                <option value="DAILY">Daily</option>
                <option value="LIFETIME">Lifetime</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-start" className="block text-sm text-muted-foreground mb-1.5">
                Start Date <span className="text-xs text-muted-foreground/60">(optional)</span>
              </label>
              <input
                id="edit-start"
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="edit-end" className="block text-sm text-muted-foreground mb-1.5">
                End Date <span className="text-xs text-muted-foreground/60">(optional)</span>
              </label>
              <input
                id="edit-end"
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !editName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* ── Info cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Sellpage */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Sellpage</h2>
          {campaign.sellpage ? (
            <div>
              <p className="text-sm font-medium text-foreground">{campaign.sellpage.urlPreview}</p>
              <p className="text-xs text-muted-foreground mt-1">Slug: {campaign.sellpage.slug}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{campaign.sellpageId}</p>
          )}
        </div>

        {/* Ad Account */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Ad Account</h2>
          <p className="text-sm font-medium text-foreground">
            {campaign.adAccountName ?? campaign.adAccountId}
          </p>
          {campaign.platform && (
            <p className="text-xs text-muted-foreground mt-1">Platform: {campaign.platform}</p>
          )}
          {campaign.externalCampaignId && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              External ID: {campaign.externalCampaignId}
            </p>
          )}
        </div>

        {/* Budget */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Budget</h2>
          <p className="text-2xl font-bold text-foreground">
            {campaign.budgetPerDay != null ? `$${campaign.budgetPerDay}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {campaign.budgetType === 'DAILY' ? 'Per day' : 'Lifetime total'}
          </p>
        </div>

        {/* Dates */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Schedule</h2>
          <div className="space-y-1.5 text-sm">
            <div>
              <span className="text-muted-foreground">Start: </span>
              <span className="text-foreground">
                {campaign.startDate ? fmtDate(campaign.startDate) : 'Immediately'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">End: </span>
              <span className="text-foreground">
                {campaign.endDate ? fmtDate(campaign.endDate) : 'No end date'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span className="text-foreground">{fmtDate(campaign.createdAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated: </span>
              <span className="text-foreground">{fmtDate(campaign.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery status */}
      {campaign.deliveryStatus && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Delivery Status</h2>
          <p className="text-sm text-foreground">{campaign.deliveryStatus}</p>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {confirmAction && (
        <ConfirmDialog
          {...CONFIRM_CONFIG[confirmAction]}
          loading={actionLoading}
          onConfirm={() => executeAction(confirmAction)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
