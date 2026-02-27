'use client';

import { useEffect, useState } from 'react';
import { Film, ImageIcon, FileText, Type, AlignLeft, Check, Loader2, ExternalLink, ChevronDown } from 'lucide-react';
import { apiGet } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import type { CreativeListItem, CreativesListResponse, AdCreativeConfig, AdFormat } from '@/types/api';
import type { ApiError } from '@/lib/apiClient';

// ── Slot definitions ────────────────────────────────────────────────────

interface SlotDef {
  key: keyof AdCreativeConfig;
  creativeType: string;
  label: string;
  icon: typeof Film;
}

const VIDEO_AD_SLOTS: SlotDef[] = [
  { key: 'videoId', creativeType: 'VIDEO', label: 'Video', icon: Film },
  { key: 'thumbnailId', creativeType: 'THUMBNAIL', label: 'Thumbnail', icon: ImageIcon },
  { key: 'adtextId', creativeType: 'ADTEXT', label: 'Adtext', icon: FileText },
  { key: 'headlineId', creativeType: 'HEADLINE', label: 'Headline', icon: Type },
  { key: 'descriptionId', creativeType: 'DESCRIPTION', label: 'Description', icon: AlignLeft },
];

const IMAGE_AD_SLOTS: SlotDef[] = [
  { key: 'thumbnailId', creativeType: 'THUMBNAIL', label: 'Thumbnail', icon: ImageIcon },
  { key: 'adtextId', creativeType: 'ADTEXT', label: 'Adtext', icon: FileText },
  { key: 'headlineId', creativeType: 'HEADLINE', label: 'Headline', icon: Type },
  { key: 'descriptionId', creativeType: 'DESCRIPTION', label: 'Description', icon: AlignLeft },
];

function getSlotsForFormat(format: AdFormat): SlotDef[] {
  return format === 'VIDEO_AD' ? VIDEO_AD_SLOTS : IMAGE_AD_SLOTS;
}

// ── Props ───────────────────────────────────────────────────────────────

interface CreativeSelectorProps {
  adsPerAdset: number;
  adCreatives: AdCreativeConfig[];
  onAdCreativeChange: (index: number, config: AdCreativeConfig) => void;
}

// ── Component ───────────────────────────────────────────────────────────

export function CreativeSelector({
  adsPerAdset,
  adCreatives,
  onAdCreativeChange,
}: CreativeSelectorProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [creatives, setCreatives] = useState<CreativeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all READY creatives
  useEffect(() => {
    setLoading(true);
    apiGet<CreativesListResponse>('/creatives?status=READY&limit=100')
      .then((res) => setCreatives(res.data ?? []))
      .catch((err) => toastApiError(err as ApiError))
      .finally(() => setLoading(false));
  }, []);

  const currentAd = adCreatives[activeTab] ?? { adFormat: 'VIDEO_AD' as AdFormat };
  const currentFormat = currentAd.adFormat;
  const slots = getSlotsForFormat(currentFormat);

  // Group creatives by type
  const creativesByType: Record<string, CreativeListItem[]> = {};
  for (const c of creatives) {
    if (!creativesByType[c.creativeType]) creativesByType[c.creativeType] = [];
    creativesByType[c.creativeType].push(c);
  }

  function setFormat(format: AdFormat) {
    // When switching format, keep shared fields, clear video if switching to IMAGE_AD
    const updated: AdCreativeConfig = {
      ...currentAd,
      adFormat: format,
    };
    if (format === 'IMAGE_AD') {
      delete updated.videoId;
    }
    onAdCreativeChange(activeTab, updated);
  }

  function selectCreativeForSlot(slotKey: keyof AdCreativeConfig, creativeId: string) {
    const currentValue = currentAd[slotKey];
    const updated: AdCreativeConfig = {
      ...currentAd,
      [slotKey]: currentValue === creativeId ? undefined : creativeId,
    };
    onAdCreativeChange(activeTab, updated);
  }

  // Count filled slots for an ad
  function countFilledSlots(ad: AdCreativeConfig): number {
    const adSlots = getSlotsForFormat(ad.adFormat);
    return adSlots.filter((s) => ad[s.key]).length;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Ad Creative Setup</h3>
        <p className="text-xs text-muted-foreground">
          Choose ad format and select creatives for each slot. Create creatives in the{' '}
          <a href="/creatives" target="_blank" className="text-primary underline inline-flex items-center gap-0.5">
            Creatives <ExternalLink size={10} />
          </a>{' '}
          section first.
        </p>
      </div>

      {/* Ad tabs */}
      {adsPerAdset > 1 && (
        <div className="flex gap-1 border-b border-border">
          {Array.from({ length: adsPerAdset }).map((_, i) => {
            const ad = adCreatives[i] ?? { adFormat: 'VIDEO_AD' as AdFormat };
            const filled = countFilledSlots(ad);
            const total = getSlotsForFormat(ad.adFormat).length;
            const allFilled = filled === total;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
                  activeTab === i
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Ad {i + 1}
                {allFilled ? (
                  <Check size={12} className="text-green-400" />
                ) : filled > 0 ? (
                  <span className="text-[9px] text-muted-foreground">{filled}/{total}</span>
                ) : null}
                {activeTab === i && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Ad Format selector */}
      <div>
        <label className="block text-xs text-muted-foreground mb-2">Ad Format</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormat('VIDEO_AD')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              currentFormat === 'VIDEO_AD'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
            }`}
          >
            <Film size={16} />
            Video Ad
            {currentFormat === 'VIDEO_AD' && <Check size={12} className="text-primary" />}
          </button>
          <button
            type="button"
            onClick={() => setFormat('IMAGE_AD')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              currentFormat === 'IMAGE_AD'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
            }`}
          >
            <ImageIcon size={16} />
            Image Ad
            {currentFormat === 'IMAGE_AD' && <Check size={12} className="text-primary" />}
          </button>
        </div>
      </div>

      {/* Per-slot creative pickers */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading creatives...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map((slot) => {
            const available = creativesByType[slot.creativeType] ?? [];
            const selectedId = currentAd[slot.key] as string | undefined;
            const selectedCreative = available.find((c) => c.id === selectedId);
            const Icon = slot.icon;

            return (
              <SlotPicker
                key={slot.key}
                slot={slot}
                available={available}
                selectedId={selectedId}
                selectedCreative={selectedCreative}
                onSelect={(id) => selectCreativeForSlot(slot.key, id)}
              />
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        {adsPerAdset > 1 ? (
          <>
            {adCreatives.filter((ad) => {
              const s = getSlotsForFormat(ad.adFormat);
              return s.every((sl) => ad[sl.key]);
            }).length}/{adsPerAdset} ads fully configured
          </>
        ) : (
          <>
            {countFilledSlots(currentAd)}/{slots.length} slots filled
          </>
        )}
      </div>
    </div>
  );
}

// ── Slot Picker (dropdown-style) ────────────────────────────────────────

interface SlotPickerProps {
  slot: SlotDef;
  available: CreativeListItem[];
  selectedId?: string;
  selectedCreative?: CreativeListItem;
  onSelect: (id: string) => void;
}

function SlotPicker({ slot, available, selectedId, selectedCreative, onSelect }: SlotPickerProps) {
  const [open, setOpen] = useState(false);
  const Icon = slot.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
          selectedId
            ? 'border-primary/40 bg-primary/5'
            : 'border-border bg-muted/30 hover:border-primary/30'
        }`}
      >
        <div className={`shrink-0 p-1.5 rounded ${
          selectedId ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{slot.label}</p>
          {selectedCreative ? (
            <p className="text-foreground font-medium truncate">{selectedCreative.name}</p>
          ) : (
            <p className="text-muted-foreground italic">Select {slot.label.toLowerCase()}...</p>
          )}
        </div>
        {selectedId && <Check size={14} className="text-primary shrink-0" />}
        <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {available.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No READY {slot.label.toLowerCase()} creatives.{' '}
                <a href="/creatives" target="_blank" className="text-primary underline">
                  Create one
                </a>
              </div>
            ) : (
              available.map((c) => {
                const isSelected = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onSelect(c.id); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-foreground'
                        : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.product && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{c.product.name}</span>
                    )}
                    {isSelected && <Check size={12} className="text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
