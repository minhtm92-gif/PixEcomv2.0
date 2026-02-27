'use client';

import { useState } from 'react';
import { Film, ImageIcon } from 'lucide-react';
import type { AdCreativeConfig } from '@/types/api';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

interface CreativeSelectorProps {
  adsPerAdset: number;
  headline: string;
  description: string;
  adCreatives: AdCreativeConfig[];
  onHeadlineChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onAdCreativeChange: (index: number, config: AdCreativeConfig) => void;
}

const DEFAULT_CREATIVE: AdCreativeConfig = {
  sourceType: 'CONTENT_SOURCE',
  mediaType: 'VIDEO',
  adText: '',
  videoUrl: '',
  thumbnailUrl: '',
  imageUrl: '',
};

export function CreativeSelector({
  adsPerAdset,
  headline,
  description,
  adCreatives,
  onHeadlineChange,
  onDescriptionChange,
  onAdCreativeChange,
}: CreativeSelectorProps) {
  const [activeTab, setActiveTab] = useState(0);

  const current = adCreatives[activeTab] ?? DEFAULT_CREATIVE;

  function update(patch: Partial<AdCreativeConfig>) {
    onAdCreativeChange(activeTab, { ...current, ...patch });
  }

  return (
    <div className="space-y-5">
      {/* Shared: Headline + Description */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">
            Headline <span className="text-[10px] text-muted-foreground/60">(shared across all ads)</span>
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => onHeadlineChange(e.target.value)}
            className={inputCls}
            placeholder="Enter headline..."
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">
            Description <span className="text-[10px] text-muted-foreground/60">(shared across all ads)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className={inputCls}
            placeholder="Enter description..."
          />
        </div>
      </div>

      {/* Tab bar */}
      {adsPerAdset > 1 && (
        <div className="flex gap-1 border-b border-border">
          {Array.from({ length: adsPerAdset }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === i
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Ad {i + 1}
              {activeTab === i && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Active tab content */}
      <div className="space-y-4">
        {/* Source type */}
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Source</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update({ sourceType: 'EXISTING' })}
              className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                current.sourceType === 'EXISTING'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
              }`}
            >
              Existing Post
            </button>
            <button
              type="button"
              onClick={() => update({ sourceType: 'CONTENT_SOURCE' })}
              className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                current.sourceType === 'CONTENT_SOURCE'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
              }`}
            >
              Content Source
            </button>
          </div>
        </div>

        {current.sourceType === 'EXISTING' ? (
          /* Existing Post */
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Post ID</label>
            <input
              type="text"
              value={current.externalPostId ?? ''}
              onChange={(e) => update({ externalPostId: e.target.value })}
              className={inputCls}
              placeholder="Enter Facebook Post ID..."
            />
          </div>
        ) : (
          /* Content Source */
          <div className="space-y-4">
            {/* Media type */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Media Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => update({ mediaType: 'VIDEO' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    current.mediaType === 'VIDEO'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <Film size={14} /> Video
                </button>
                <button
                  type="button"
                  onClick={() => update({ mediaType: 'IMAGE' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    current.mediaType === 'IMAGE'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <ImageIcon size={14} /> Image
                </button>
              </div>
            </div>

            {/* Ad Text */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Ad Text</label>
              <textarea
                value={current.adText ?? ''}
                onChange={(e) => update({ adText: e.target.value })}
                className={`${inputCls} min-h-[80px] resize-y`}
                placeholder="Enter ad copy..."
                rows={3}
              />
            </div>

            {current.mediaType === 'VIDEO' ? (
              <>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">Video URL</label>
                  <input
                    type="text"
                    value={current.videoUrl ?? ''}
                    onChange={(e) => update({ videoUrl: e.target.value })}
                    className={inputCls}
                    placeholder="https://cdn.pixelxlab.com/..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">Thumbnail URL</label>
                  <input
                    type="text"
                    value={current.thumbnailUrl ?? ''}
                    onChange={(e) => update({ thumbnailUrl: e.target.value })}
                    className={inputCls}
                    placeholder="https://cdn.pixelxlab.com/..."
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Image URL</label>
                <input
                  type="text"
                  value={current.imageUrl ?? ''}
                  onChange={(e) => update({ imageUrl: e.target.value })}
                  className={inputCls}
                  placeholder="https://cdn.pixelxlab.com/..."
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
