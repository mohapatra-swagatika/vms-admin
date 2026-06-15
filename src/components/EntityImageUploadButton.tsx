'use client';
import { useEffect, useRef, useState } from 'react';
import { api, MAX_ENTITY_IMAGES_PER_UPLOAD, validateImageFile } from '@/lib/api';
import { canUploadChildEntityImage } from '@/lib/auth';

export type EntityImageType = 'tower' | 'company' | 'organization' | 'location';

type Props = {
  entityType: EntityImageType;
  entityId: string;
  onUploaded?: (latestImageUrl?: string) => void;
  className?: string;
};

const defaultClass =
  'text-xs text-violet-700 hover:bg-violet-50 border border-violet-200 px-2 py-1 rounded transition-colors disabled:opacity-50';

export default function EntityImageUploadButton({ entityType, entityId, onUploaded, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    function recheck() { setAllowed(canUploadChildEntityImage()); }
    recheck();
    window.addEventListener('vms_permissions_updated', recheck);
    return () => window.removeEventListener('vms_permissions_updated', recheck);
  }, []);

  if (!allowed) return null;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    if (selected.length > MAX_ENTITY_IMAGES_PER_UPLOAD) {
      alert(`You can select up to ${MAX_ENTITY_IMAGES_PER_UPLOAD} images at a time.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    for (const file of selected) {
      const validationError = validateImageFile(file);
      if (validationError) {
        alert(validationError);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
    }

    setUploading(true);
    try {
      const result = await api.uploadEntityImages(entityType, entityId, selected);
      onUploaded?.(result.image_url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
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
        onChange={handleFiles}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={className ?? defaultClass}
        title={`Select one or more images (max ${MAX_ENTITY_IMAGES_PER_UPLOAD})`}
      >
        {uploading ? 'Uploading…' : '📷 Upload Image'}
      </button>
    </>
  );
}
