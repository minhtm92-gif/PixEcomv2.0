'use client';

/**
 * AssetUploader
 *
 * Drag-and-drop + file-picker upload component.
 * Upload flow:
 *   1. POST /assets/upload-url → { uploadUrl, assetId }
 *   2. PUT file to uploadUrl (R2 signed URL, no auth header) via XMLHttpRequest for progress
 *   3. POST /assets { filename, mimeType, size, url } to register asset record
 *   4. Calls onSuccess(assetId)
 *
 * File limits:
 *   - image/*   → max 10 MB
 *   - video/*   → max 50 MB
 */

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, X, FileVideo, ImageIcon, Loader2 } from 'lucide-react';
import { apiPost } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import type { UploadUrlResponse } from '@/types/api';
import type { ApiError } from '@/lib/apiClient';

const CDN_BASE = 'https://cdn.pixelxlab.com';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
];

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM.`;
  }
  if (file.type.startsWith('image/') && file.size > MAX_IMAGE_BYTES) {
    return `Image exceeds 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  if (file.type.startsWith('video/') && file.size > MAX_VIDEO_BYTES) {
    return `Video exceeds 50 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type UploadStage = 'idle' | 'getting-url' | 'uploading' | 'registering' | 'done' | 'error';

export interface AssetUploaderProps {
  onSuccess: (assetId: string) => void;
  onClose: () => void;
}

export function AssetUploader({ onSuccess, onClose }: AssetUploaderProps) {
  const addToast = useToastStore((s) => s.add);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [stage, setStage] = useState<UploadStage>('idle');
  const [progress, setProgress] = useState(0); // 0-100
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── File selection ──
  function selectFile(f: File) {
    const err = validateFile(f);
    if (err) {
      setValidationError(err);
      setFile(null);
      return;
    }
    setValidationError(null);
    setFile(f);
    setUploadError(null);
    setStage('idle');
    setProgress(0);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
    // Reset so same file can be re-selected
    e.target.value = '';
  }

  // ── Drag & Drop ──
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) selectFile(f);
  }

  // ── Upload ──
  async function handleUpload() {
    if (!file) return;
    setUploadError(null);

    try {
      // Step 1: Get signed upload URL
      setStage('getting-url');
      const { uploadUrl, assetId } = await apiPost<UploadUrlResponse>('/assets/upload-url', {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

      // Step 2: PUT file directly to R2 via XHR (for progress tracking)
      setStage('uploading');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100);
            resolve();
          } else {
            reject(new Error(`R2 upload failed: HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during file upload'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));

        xhr.open('PUT', uploadUrl);
        // R2 signed URL: set Content-Type, do NOT send Authorization
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.timeout = 5 * 60 * 1000; // 5 min timeout for large videos
        xhr.send(file);
      });

      // Step 3: Register asset record in backend
      setStage('registering');
      await apiPost('/assets', {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        url: `${CDN_BASE}/${assetId}`,
      });

      // Step 4: Done — notify parent
      setStage('done');
      addToast('Asset uploaded successfully', 'success');
      onSuccess(assetId);
    } catch (err) {
      setStage('error');
      const msg = err instanceof Error ? err.message : (err as ApiError)?.message ?? 'Upload failed';
      setUploadError(msg);
      if (typeof err === 'object' && err !== null && 'status' in err) {
        toastApiError(err as ApiError);
      } else {
        addToast(msg, 'error');
      }
    }
  }

  const isUploading = stage === 'getting-url' || stage === 'uploading' || stage === 'registering';

  const stageLabel: Record<UploadStage, string> = {
    idle: '',
    'getting-url': 'Preparing upload…',
    uploading: `Uploading… ${progress}%`,
    registering: 'Registering asset…',
    done: 'Done!',
    error: 'Upload failed',
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3
          border-2 border-dashed rounded-xl px-6 py-10 transition-colors cursor-pointer
          ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />

        {file ? (
          <>
            {file.type.startsWith('video/') ? (
              <FileVideo size={36} className="text-primary" />
            ) : (
              <ImageIcon size={36} className="text-primary" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-foreground truncate max-w-[240px]">{file.name}</p>
              <p className="text-xs text-muted-foreground">{file.type} · {formatBytes(file.size)}</p>
            </div>
            {!isUploading && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); setUploadError(null); setStage('idle'); }}
                className="absolute top-2 right-2 p-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </>
        ) : (
          <>
            <UploadCloud size={36} className="text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-foreground font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Images (JPEG, PNG, GIF, WebP) up to 10 MB · Videos (MP4, WebM) up to 50 MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {validationError}
        </p>
      )}

      {/* Progress bar */}
      {isUploading && (
        <div className="space-y-1.5">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-primary rounded-full transition-all duration-200"
              style={{ width: `${stage === 'getting-url' || stage === 'registering' ? 5 : progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">{stageLabel[stage]}</p>
        </div>
      )}

      {/* Upload error */}
      {uploadError && stage === 'error' && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {uploadError}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isUploading}
          className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading || !!validationError}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                     hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isUploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {stageLabel[stage]}
            </>
          ) : (
            <>
              <UploadCloud size={14} />
              Upload
            </>
          )}
        </button>
      </div>
    </div>
  );
}
