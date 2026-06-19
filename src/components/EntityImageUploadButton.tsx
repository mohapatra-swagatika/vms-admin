'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, X } from 'lucide-react';
import { api, MAX_ENTITY_IMAGES_PER_UPLOAD, validateImageFile } from '@/lib/api';
import { canUploadChildEntityImage, canUploadSelfImage } from '@/lib/auth';
import { IconLabel } from '@/components/IconLabel';
import { UploadButtonProgress } from '@/components/UploadProgressOverlay';

export type EntityImageType = 'tower' | 'company' | 'organization' | 'location';

const DEFAULT_IDLE_LABEL = (
  <IconLabel icon={Camera}>Add Gallery Images</IconLabel>
);

type Props = {
  mode: 'self' | 'child';
  entityType: EntityImageType;
  entityId: string;
  onUploaded?: () => void;
  onProgressChange?: (progress: number | null) => void;
  className?: string;
  idleLabel?: ReactNode;
};

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const defaultClass =
  'text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded transition-colors disabled:opacity-50';

function revokePreviews(items: PendingImage[]) {
  items.forEach(item => URL.revokeObjectURL(item.previewUrl));
}

export default function EntityImageUploadButton({
  mode,
  entityType,
  entityId,
  onUploaded,
  onProgressChange,
  className,
  idleLabel = DEFAULT_IDLE_LABEL,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function recheck() {
      setAllowed(mode === 'self' ? canUploadSelfImage() : canUploadChildEntityImage());
    }
    recheck();
    window.addEventListener('vms_permissions_updated', recheck);
    return () => window.removeEventListener('vms_permissions_updated', recheck);
  }, [mode]);

  if (!allowed) return null;

  function reportProgress(value: number | null) {
    if (value === null) {
      onProgressChange?.(null);
      return;
    }
    setProgress(value);
    onProgressChange?.(value);
  }

  function resetPicker() {
    if (inputRef.current) inputRef.current.value = '';
  }

  function closePreview() {
    setShowPreview(false);
    setPending(prev => {
      revokePreviews(prev);
      return [];
    });
    resetPicker();
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    resetPicker();
    if (!selected.length) return;

    if (selected.length > MAX_ENTITY_IMAGES_PER_UPLOAD) {
      alert(`You can select up to ${MAX_ENTITY_IMAGES_PER_UPLOAD} images at a time.`);
      return;
    }

    for (const file of selected) {
      const validationError = validateImageFile(file);
      if (validationError) {
        alert(validationError);
        return;
      }
    }

    const next = selected.map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPending(prev => {
      const combined = prev.length ? [...prev, ...next] : next;
      if (combined.length > MAX_ENTITY_IMAGES_PER_UPLOAD) {
        alert(`You can select up to ${MAX_ENTITY_IMAGES_PER_UPLOAD} images at a time.`);
        revokePreviews(next);
        return prev;
      }
      return combined;
    });
    setShowPreview(true);
  }

  function removePending(id: string) {
    setPending(prev => {
      const target = prev.find(item => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const remaining = prev.filter(item => item.id !== id);
      if (!remaining.length) setShowPreview(false);
      return remaining;
    });
  }

  async function confirmUpload() {
    if (!pending.length || uploading) return;

    setUploading(true);
    reportProgress(0);
    try {
      await api.uploadEntityImages(
        entityType,
        entityId,
        pending.map(item => item.file),
        { onProgress: reportProgress },
      );
      closePreview();
      onUploaded?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setUploading(false);
      reportProgress(null);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFilesSelected}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={className ?? defaultClass}
        title={`Select gallery images (max ${MAX_ENTITY_IMAGES_PER_UPLOAD})`}
      >
        {uploading ? (
          <UploadButtonProgress uploading progress={progress} idleLabel={idleLabel} />
        ) : (
          idleLabel
        )}
      </button>

      {showPreview && pending.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => { if (!uploading) closePreview(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-5 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">Review gallery images</h3>
            <p className="text-xs text-gray-500 mt-1">
              {pending.length} image{pending.length !== 1 ? 's' : ''} selected. Remove any you do not want, then upload.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {pending.map(item => (
                <div key={item.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="w-full aspect-square object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePending(item.id)}
                    disabled={uploading}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-50"
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                  <p className="px-2 py-1 text-[10px] text-gray-500 truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={closePreview}
                disabled={uploading}
                className="text-xs px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="text-xs px-4 py-2 border border-primary-border rounded-lg text-primary hover:bg-primary-muted disabled:opacity-50"
              >
                Add more
              </button>
              <button
                type="button"
                onClick={confirmUpload}
                disabled={uploading || !pending.length}
                className="text-xs px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {uploading ? `Uploading… ${progress}%` : 'Upload Images'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
