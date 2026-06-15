'use client';
import { useCallback, useEffect, useState } from 'react';
import { mediaSrc } from '@/lib/api';
import EntityAvatar from '@/components/EntityAvatar';
import UploadProgressOverlay from '@/components/UploadProgressOverlay';

export type EntityImage = { id: string; image_url: string; created_at: string };

type Props = {
  entityName: string;
  images: EntityImage[];
  loading?: boolean;
  uploadProgress?: number | null;
  className?: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function EntityImageCarousel({ entityName, images, loading, uploadProgress, className }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideLoading, setSlideLoading] = useState(true);

  const count = images.length;
  const hasImages = count > 0;
  const active = hasImages ? images[activeIndex] : null;
  const src = mediaSrc(active?.image_url);

  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  useEffect(() => {
    if (!src) {
      setSlideLoading(false);
      return;
    }
    setSlideLoading(true);
    const img = new Image();
    img.onload = () => setSlideLoading(false);
    img.onerror = () => setSlideLoading(false);
    img.src = src;
    if (img.complete) setSlideLoading(false);
  }, [activeIndex, src]);

  useEffect(() => {
    images.forEach((item, i) => {
      if (i === activeIndex) return;
      const url = mediaSrc(item.image_url);
      if (url) {
        const pre = new Image();
        pre.src = url;
      }
    });
  }, [images, activeIndex]);

  const goTo = useCallback((index: number) => {
    if (!count) return;
    setActiveIndex(((index % count) + count) % count);
  }, [count]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!count || count < 2) return;
      if (e.key === 'ArrowLeft') goTo(activeIndex - 1);
      if (e.key === 'ArrowRight') goTo(activeIndex + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, count, goTo]);

  if (loading) {
    return (
      <div className={`w-full ${className ?? ''}`}>
        <div className="aspect-[4/3] sm:aspect-[16/10] rounded-xl bg-gray-100 animate-pulse border border-gray-200" />
        <div className="mt-3 flex justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasImages) {
    return (
      <div className={`w-full ${className ?? ''}`}>
        <div className="relative aspect-[4/3] sm:aspect-[16/10] rounded-xl border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <EntityAvatar name={entityName} size="lg" uploadProgress={uploadProgress} />
          <div>
            <p className="text-sm font-medium text-gray-700">No entity images yet</p>
            <p className="text-xs text-gray-500 mt-0.5">Upload images for this entity to see them here</p>
          </div>
          {uploadProgress != null && (
            <div className="w-full max-w-xs px-4">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-[width] duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {uploadProgress >= 95 ? 'Processing on server…' : `Uploading ${uploadProgress}%`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full select-none ${className ?? ''}`}>
      <div className="relative aspect-[4/3] sm:aspect-[16/10] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group">
        {slideLoading && (
          <div className="absolute inset-0 bg-gray-100 animate-pulse z-10" aria-hidden />
        )}
        {src ? (
          <img
            key={src}
            src={src}
            alt={`${entityName} — image ${activeIndex + 1} of ${count}`}
            decoding="async"
            fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
            className={`w-full h-full object-cover transition-opacity duration-200 ${slideLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setSlideLoading(false)}
            onError={() => setSlideLoading(false)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <EntityAvatar name={entityName} size="lg" />
          </div>
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-200 shadow-sm text-gray-700 hover:bg-white opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity flex items-center justify-center"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-200 shadow-sm text-gray-700 hover:bg-white opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity flex items-center justify-center"
              aria-label="Next image"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`rounded-full transition-all ${
                    i === activeIndex ? 'w-2.5 h-2.5 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`Go to image ${i + 1}`}
                  aria-current={i === activeIndex ? 'true' : undefined}
                />
              ))}
            </div>
          </>
        )}

        {activeIndex === 0 && count > 0 && (
          <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary text-white shadow-sm">
            Latest
          </span>
        )}

        {uploadProgress != null && (
          <UploadProgressOverlay progress={uploadProgress} roundedClass="rounded-xl" />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 px-0.5">
        <span>
          {activeIndex + 1} of {count}
          {activeIndex === 0 ? ' · Latest upload' : ''}
        </span>
        {active?.created_at && <span>{formatDate(active.created_at)}</span>}
      </div>
    </div>
  );
}
