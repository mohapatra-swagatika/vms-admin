'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
  compact?: boolean;
  hero?: boolean;
  autoPlay?: boolean;
  overlay?: ReactNode;
};

const FADE_MS = 800;
const AUTO_PLAY_MS = 5500;

const aspectClass = (compact?: boolean, hero?: boolean) => {
  if (hero) return 'aspect-[21/9] min-h-[200px] sm:min-h-[260px]';
  if (compact) return 'aspect-[2/1]';
  return 'aspect-[4/3] sm:aspect-[16/10]';
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

export default function EntityImageCarousel({
  entityName, images, loading, uploadProgress, className, compact, hero, autoPlay, overlay,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [initialReady, setInitialReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const count = images.length;
  const hasImages = count > 0;
  const active = hasImages ? images[activeIndex] : null;

  useEffect(() => {
    setActiveIndex(0);
    setInitialReady(false);
  }, [images]);

  const goTo = useCallback((index: number) => {
    if (!count) return;
    setActiveIndex(((index % count) + count) % count);
  }, [count]);

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!count || count < 2) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, goNext, goPrev]);

  useEffect(() => {
    if (!autoPlay || count < 2 || paused) return;
    const id = window.setInterval(() => {
      setActiveIndex(i => (i + 1) % count);
    }, AUTO_PLAY_MS);
    return () => window.clearInterval(id);
  }, [autoPlay, count, paused]);

  // Preload all slide images once the list is known.
  useEffect(() => {
    if (!hasImages) return;
    let cancelled = false;
    const urls = images.map(img => mediaSrc(img.image_url)).filter(Boolean) as string[];

    Promise.all(
      urls.map(
        url => new Promise<void>(resolve => {
          const img = new window.Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
      ),
    ).then(() => {
      if (!cancelled) setInitialReady(true);
    });

    return () => { cancelled = true; };
  }, [hasImages, images]);

  const frameRadius = hero ? 'rounded-2xl' : 'rounded-xl';
  const navBtnClass = hero
    ? 'w-11 h-11 text-lg bg-black/30 border-white/20 text-white hover:bg-black/50 backdrop-blur-sm'
    : 'w-9 h-9 bg-white/90 border-gray-200 text-gray-700 hover:bg-white';

  if (loading) {
    return (
      <div className={`w-full ${className ?? ''}`}>
        <div className={`${aspectClass(compact, hero)} ${frameRadius} bg-gray-100 animate-pulse border border-gray-200`} />
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
        <div className={`${aspectClass(compact, hero)} ${frameRadius} border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center relative`}>
          {hero && overlay && (
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-transparent pointer-events-none">
              {overlay}
            </div>
          )}
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
      <div
        className={`relative ${aspectClass(compact, hero)} ${frameRadius} overflow-hidden bg-gray-900 border border-gray-200 group ${hero ? 'shadow-lg' : ''}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {!initialReady && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse z-20" aria-hidden />
        )}

        {images.map((img, i) => {
          const src = mediaSrc(img.image_url);
          if (!src) return null;
          const isActive = i === activeIndex;
          return (
            <img
              key={img.id}
              src={src}
              alt={`${entityName} — image ${i + 1} of ${count}`}
              aria-hidden={!isActive}
              className={`absolute inset-0 w-full h-full object-cover will-change-opacity ${
                hero ? 'duration-700 ease-in-out' : 'duration-500 ease-in-out'
              } transition-opacity ${
                isActive && initialReady ? 'opacity-100 z-[1]' : 'opacity-0 z-0'
              }`}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            />
          );
        })}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full border shadow-sm opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity duration-300 flex items-center justify-center ${navBtnClass}`}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full border shadow-sm opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity duration-300 flex items-center justify-center ${navBtnClass}`}
              aria-label="Next image"
            >
              ›
            </button>
            <div className={`absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${hero ? 'bottom-20 sm:bottom-24' : 'bottom-3'}`}>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`rounded-full transition-all duration-300 ${
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
          <span className={`absolute top-3 left-3 z-10 font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-primary text-white shadow-sm ${hero ? 'text-[11px]' : 'text-[10px]'}`}>
            Latest
          </span>
        )}

        {uploadProgress != null && (
          <UploadProgressOverlay progress={uploadProgress} roundedClass={frameRadius} />
        )}

        {hero && overlay && (
          <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6 pt-16 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none">
            {overlay}
          </div>
        )}
      </div>

      {!hero && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 px-0.5">
          <span>
            {activeIndex + 1} of {count}
            {activeIndex === 0 ? ' · Latest upload' : ''}
          </span>
          {active?.created_at && <span>{formatDate(active.created_at)}</span>}
        </div>
      )}
    </div>
  );
}
