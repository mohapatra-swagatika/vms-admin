'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, mediaSrc } from '@/lib/api';
import {
  canDeleteGalleryImage,
  canUploadGalleryImage,
} from '@/lib/auth';
import { clearEntityGalleryCache, writeEntityGalleryCache } from '@/lib/entityGalleryCache';
import EntityImageUploadButton, { type EntityImageType } from '@/components/EntityImageUploadButton';
import type { EntityImage } from '@/components/EntityImageCarousel';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import FlashToast from '@/components/FlashToast';

type Props = {
  entityType: EntityImageType;
  entityId: string;
  entityName?: string | null;
  mode: 'self' | 'child';
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function EntityGalleryPanel({
  entityType,
  entityId,
  entityName,
  mode,
}: Props) {
  const [images, setImages] = useState<EntityImage[]>([]);
  const [resolvedName, setResolvedName] = useState(entityName ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const canUpload = canUploadGalleryImage(mode);
  const canDelete = canDeleteGalleryImage(mode);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getEntityImages(entityType, entityId);
      setImages(data.images ?? []);
      setResolvedName(data.entity_name ?? entityName ?? null);
      writeEntityGalleryCache(entityType, entityId, {
        entity_name: data.entity_name,
        images: data.images ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery');
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, entityName]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  async function handleDelete(image: EntityImage) {
    if (!canDelete || deletingId) return;

    const ok = await confirm({
      title: 'Delete gallery image?',
      message: 'This image will be removed from the slider and cannot be recovered.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(image.id);
    try {
      await api.deleteEntityGalleryImage(entityType, entityId, image.id);
      clearEntityGalleryCache(entityType, entityId);
      setFlash('Image deleted');
      await loadGallery();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete image');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <FlashToast message={flash} variant="success" onDismiss={() => setFlash(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {resolvedName || 'Gallery'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {images.length} image{images.length !== 1 ? 's' : ''} in slider gallery
          </p>
        </div>
        {canUpload && (
          <EntityImageUploadButton
            mode={mode}
            entityType={entityType}
            entityId={entityId}
            onUploaded={() => {
              clearEntityGalleryCache(entityType, entityId);
              setFlash('Gallery images uploaded');
              loadGallery();
            }}
          />
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger-border bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">No gallery images yet</p>
          <p className="text-xs text-gray-500 mt-1">
            {canUpload
              ? 'Use Add Gallery Images to upload photos for the dashboard and mobile slider.'
              : 'No images have been uploaded for this entity.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map(image => {
            const src = mediaSrc(image.image_url);
            const isDeleting = deletingId === image.id;
            return (
              <div
                key={image.id}
                className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm"
              >
                {src ? (
                  <img src={src} alt="" className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-gray-100" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                  <p className="text-[10px] text-white/90 truncate">{formatDate(image.created_at)}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(image)}
                    disabled={isDeleting}
                    className="absolute top-2 right-2 px-2 py-1 rounded-md text-[11px] font-medium bg-white/95 text-danger hover:bg-white shadow disabled:opacity-60"
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
