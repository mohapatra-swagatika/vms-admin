'use client';
import { useEffect, useRef, useState } from 'react';
import { mediaSrc } from '@/lib/api';
import { canUploadSelfImage } from '@/lib/auth';
import EntityAvatar from '@/components/EntityAvatar';
import SelfProfileImageUpload from '@/components/SelfProfileImageUpload';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import UploadProgressOverlay from '@/components/UploadProgressOverlay';

type UserInfo = { id: string; name: string; email: string };

type Props = {
  user: UserInfo;
  profileImageUrl: string | null;
  profileImageVersion?: number;
  onProfileImageChange: (url: string) => void;
};

export default function ProfileMenu({
  user, profileImageUrl, profileImageVersion = 0, onProfileImageChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [ready, setReady] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const src = mediaSrc(profileImageUrl, profileImageVersion);

  useEffect(() => {
    function recheck() { setCanUpload(canUploadSelfImage()); }
    recheck();
    setReady(true);
    window.addEventListener('vms_permissions_updated', recheck);
    return () => window.removeEventListener('vms_permissions_updated', recheck);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 rounded-full p-0.5 hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Open profile menu"
        >
          <EntityAvatar
            name={user.name}
            imageUrl={profileImageUrl}
            imageVersion={profileImageVersion}
            uploadProgress={uploadProgress}
            size="md"
          />
          <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] md:max-w-[160px] truncate">
            {user.name}
          </span>
          <svg
            className={`hidden sm:block w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute right-0 mt-2 w-[min(100vw-2rem,20rem)] bg-white rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50 overflow-hidden z-[60]"
            role="menu"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
            </div>

            <div className="p-4">
              <button
                type="button"
                onClick={() => src && setLightbox(true)}
                disabled={!src && uploadProgress == null}
                className={`relative w-full aspect-square max-h-48 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center mb-3 transition-opacity ${
                  src ? 'cursor-zoom-in hover:opacity-95' : 'cursor-default opacity-80'
                }`}
                title={src ? 'View full size' : undefined}
              >
                {src ? (
                  <img
                    key={`${profileImageUrl}-${profileImageVersion}`}
                    src={src}
                    alt={`${user.name} profile`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <EntityAvatar name={user.name} imageUrl={null} size="lg" uploadProgress={uploadProgress} />
                )}
                {uploadProgress != null && src && (
                  <UploadProgressOverlay progress={uploadProgress} variant="panel" roundedClass="rounded-xl" />
                )}
              </button>

              {src && (
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="w-full mb-3 text-xs text-primary hover:text-primary font-medium py-1"
                >
                  View full size
                </button>
              )}

              {ready && canUpload && (
                <SelfProfileImageUpload
                  onUploaded={(url) => onProfileImageChange(url)}
                  onProgressChange={setUploadProgress}
                  className="w-full text-sm text-primary hover:bg-primary-muted border border-primary-border px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-center block"
                />
              )}

              {!src && ready && !canUpload && (
                <p className="text-xs text-gray-400 text-center">No profile image uploaded</p>
              )}
            </div>
          </div>
        )}
      </div>

      <ImagePreviewModal
        open={lightbox && !!src}
        src={src ?? ''}
        alt={`${user.name} — profile`}
        onClose={() => setLightbox(false)}
      />
    </>
  );
}
