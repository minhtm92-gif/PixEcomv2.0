'use client';

import { useEffect, useState } from 'react';
import { Film, ImageIcon, FileText, Check, Loader2, ExternalLink } from 'lucide-react';
import { apiGet } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import type { CreativeListItem, CreativesListResponse, AdCreativeConfig } from '@/types/api';
import type { ApiError } from '@/lib/apiClient';

interface CreativeSelectorProps {
  adsPerAdset: number;
  adCreatives: AdCreativeConfig[];
  onAdCreativeChange: (index: number, config: AdCreativeConfig) => void;
}

const typeIcons: Record<string, typeof Film> = {
  ADTEXT: FileText,
  VIDEO: Film,
  THUMBNAIL: ImageIcon,
  HEADLINE: FileText,
  DESCRIPTION: FileText,
  // Legacy
  VIDEO_AD: Film,
  IMAGE_AD: ImageIcon,
  TEXT_ONLY: FileText,
  UGC_BUNDLE: Film,
};

const typeLabels: Record<string, string> = {
  ADTEXT: 'Adtext',
  VIDEO: 'Video',
  THUMBNAIL: 'Thumbnail',
  HEADLINE: 'Headline',
  DESCRIPTION: 'Description',
  // Legacy
  VIDEO_AD: 'Video Ad',
  IMAGE_AD: 'Image Ad',
  TEXT_ONLY: 'Text Only',
  UGC_BUNDLE: 'UGC Bundle',
};

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

  const currentCreativeId = adCreatives[activeTab]?.creativeId ?? '';

  function selectCreative(creativeId: string) {
    if (currentCreativeId === creativeId) {
      // Deselect
      onAdCreativeChange(activeTab, { creativeId: '' });
    } else {
      onAdCreativeChange(activeTab, { creativeId });
    }
  }

  // Check which creatives are already selected by other ads
  const selectedByOtherAds = new Set(
    adCreatives
      .filter((_, i) => i !== activeTab)
      .map((c) => c.creativeId)
      .filter(Boolean),
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Select Creative per Ad</h3>
        <p className="text-xs text-muted-foreground">
          Choose an existing creative for each ad. Create creatives in the{' '}
          <a href="/creatives" target="_blank" className="text-primary underline inline-flex items-center gap-0.5">
            Creatives <ExternalLink size={10} />
          </a>{' '}
          section first.
        </p>
      </div>

      {/* Tab bar */}
      {adsPerAdset > 1 && (
        <div className="flex gap-1 border-b border-border">
          {Array.from({ length: adsPerAdset }).map((_, i) => {
            const hasCreative = !!adCreatives[i]?.creativeId;
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
                {hasCreative && <Check size={12} className="text-green-400" />}
                {activeTab === i && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Creative grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading creatives...</span>
        </div>
      ) : creatives.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No READY creatives found.{' '}
          <a href="/creatives" target="_blank" className="text-primary underline">
            Create one first
          </a>.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {creatives.map((creative) => {
            const isSelected = currentCreativeId === creative.id;
            const usedByOther = selectedByOtherAds.has(creative.id);
            const Icon = typeIcons[creative.creativeType] ?? FileText;

            return (
              <button
                key={creative.id}
                type="button"
                onClick={() => selectCreative(creative.id)}
                disabled={usedByOther}
                className={`relative flex items-start gap-3 p-3 rounded-lg border text-left text-sm transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : usedByOther
                      ? 'border-border bg-muted/20 opacity-40 cursor-not-allowed'
                      : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <div className={`shrink-0 p-2 rounded-lg ${
                  isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{creative.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {typeLabels[creative.creativeType] ?? creative.creativeType}
                    {creative.product && ` · ${creative.product.name}`}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check size={14} className="text-primary" />
                  </div>
                )}
                {usedByOther && (
                  <div className="absolute top-2 right-2 text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Used
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {adsPerAdset > 1 && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          {adCreatives.filter((c) => c.creativeId).length}/{adsPerAdset} ads have a creative assigned
        </div>
      )}
    </div>
  );
}
