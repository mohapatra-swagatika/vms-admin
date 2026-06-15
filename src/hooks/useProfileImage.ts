'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getStoredProfileImage, getUser, setStoredProfileImage } from '@/lib/auth';

/** Shared profile image state for header, dashboard, and upload components. */
export function useProfileImage() {
  const [url, setUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const apply = useCallback((imageUrl: string | null, v?: number) => {
    setUrl(imageUrl);
    if (v) setVersion(v);
    else if (imageUrl) setVersion(Date.now());
  }, []);

  useEffect(() => {
    const stored = getStoredProfileImage();
    apply(stored.url, stored.version || undefined);

    const u = getUser();
    if (!u?.id) return;

    api.getUser(u.id)
      .then((data: { profile_image_url?: string | null }) => {
        const apiUrl = data.profile_image_url ?? null;
        if (!apiUrl) return;
        // Prefer a fresh signed URL from the API (stored URLs expire).
        apply(apiUrl, Date.now());
      })
      .catch(() => { /* use cached value */ });

    function onUpdate(e: Event) {
      const detail = (e as CustomEvent<{ url: string; version: number }>).detail;
      if (detail?.url) apply(detail.url, detail.version);
    }
    window.addEventListener('vms_profile_image_updated', onUpdate);
    return () => window.removeEventListener('vms_profile_image_updated', onUpdate);
  }, [apply]);

  const onUploaded = useCallback((imageUrl: string) => {
    const v = setStoredProfileImage(imageUrl);
    apply(imageUrl, v);
  }, [apply]);

  return { url, version, onUploaded };
}
