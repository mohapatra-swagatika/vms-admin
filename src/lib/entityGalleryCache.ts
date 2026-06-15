import type { EntityImage } from '@/components/EntityImageCarousel';

export type EntityGalleryData = {
  entity_name: string | null;
  images: EntityImage[];
};

function cacheKey(type: string, id: string) {
  return `vms_gallery_${type}_${id}`;
}

export function readEntityGalleryCache(type: string, id: string): EntityGalleryData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(type, id));
    return raw ? JSON.parse(raw) as EntityGalleryData : null;
  } catch {
    return null;
  }
}

export function writeEntityGalleryCache(type: string, id: string, data: EntityGalleryData) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(cacheKey(type, id), JSON.stringify(data));
  } catch { /* storage full */ }
}
