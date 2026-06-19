'use client';
import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { api, validateImageFile } from '@/lib/api';
import { canUploadSelfImage, getScopedEntity } from '@/lib/auth';
import { IconLabel } from '@/components/IconLabel';
import { UploadButtonProgress } from '@/components/UploadProgressOverlay';

type Props = {
  onUploaded?: (imageUrl: string) => void;
  onProgressChange?: (progress: number | null) => void;
  className?: string;
};

const defaultClass =
  'text-xs text-white/90 hover:text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/25 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50';


/** Upload profile image for the logged-in user's own scoped entity (dashboard only). */
export default function SelfEntityProfileImageUpload({
  onUploaded,
  onProgressChange,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [allowed, setAllowed] = useState(false);
  const scopedEntity = getScopedEntity();

  useEffect(() => {
    function recheck() { setAllowed(canUploadSelfImage() && !!getScopedEntity()); }
    recheck();
    window.addEventListener('vms_permissions_updated', recheck);
    return () => window.removeEventListener('vms_permissions_updated', recheck);
  }, []);

  if (!allowed || !scopedEntity) return null;

  const { type: entityType, id: entityId } = scopedEntity;

  function reportProgress(value: number | null) {
    if (value === null) {
      onProgressChange?.(null);
      return;
    }
    setProgress(value);
    onProgressChange?.(value);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      alert(validationError);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    reportProgress(0);
    try {
      const result = await api.uploadEntityProfileImage(entityType, entityId, file, {
        onProgress: reportProgress,
      });
      if (!result.image_url) throw new Error('Upload succeeded but no image URL was returned');
      onUploaded?.(result.image_url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload profile image');
    } finally {
      setUploading(false);
      reportProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
    </>
  );
}
