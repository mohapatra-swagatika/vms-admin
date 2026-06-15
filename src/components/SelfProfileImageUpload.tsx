'use client';
import { useEffect, useRef, useState } from 'react';
import { api, validateImageFile } from '@/lib/api';
import { canUploadSelfImage, getUser, setStoredProfileImage } from '@/lib/auth';

type Props = {
  onUploaded?: (profileImageUrl: string) => void;
  onProgressChange?: (progress: number | null) => void;
  className?: string;
};

const defaultClass =
  'text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded transition-colors disabled:opacity-50';

export default function SelfProfileImageUpload({ onUploaded, onProgressChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function recheck() { setAllowed(canUploadSelfImage()); }
    recheck();
    setReady(true);
    window.addEventListener('vms_permissions_updated', recheck);
    return () => window.removeEventListener('vms_permissions_updated', recheck);
  }, []);

  if (!ready || !allowed) return null;

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
    const userId = getUser()?.id;
    if (!file || !userId) return;
    const validationError = validateImageFile(file);
    if (validationError) { alert(validationError); return; }
    setUploading(true);
    reportProgress(0);
    try {
      const result = await api.uploadProfileImage(userId, file, { onProgress: reportProgress });
      setStoredProfileImage(result.profile_image_url);
      onUploaded?.(result.profile_image_url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image');
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={className ?? defaultClass}
      >
        {uploading ? `Uploading ${progress}%` : '📷 Upload Image'}
      </button>
    </>
  );
}
