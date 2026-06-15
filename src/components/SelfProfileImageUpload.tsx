'use client';
import { useEffect, useRef, useState } from 'react';
import { api, validateImageFile } from '@/lib/api';
import { canUploadSelfImage, getUser, setStoredProfileImage } from '@/lib/auth';

type Props = {
  onUploaded?: (profileImageUrl: string) => void;
  className?: string;
};

const defaultClass =
  'text-xs text-violet-700 hover:bg-violet-50 border border-violet-200 px-2 py-1 rounded transition-colors disabled:opacity-50';

export default function SelfProfileImageUpload({ onUploaded, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const userId = getUser()?.id;
    if (!file || !userId) return;
    const validationError = validateImageFile(file);
    if (validationError) { alert(validationError); return; }
    setUploading(true);
    try {
      const result = await api.uploadProfileImage(userId, file);
      setStoredProfileImage(result.profile_image_url);
      onUploaded?.(result.profile_image_url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image');
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
        {uploading ? 'Uploading…' : '📷 Upload Image'}
      </button>
    </>
  );
}
