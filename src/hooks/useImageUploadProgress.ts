'use client';
import { useCallback, useState } from 'react';

/** Track per-entity upload progress for avatar overlays. */
export function useImageUploadProgress() {
  const [map, setMap] = useState<Record<string, number>>({});

  const getProgress = useCallback((id: string) => map[id] ?? null, [map]);

  const onProgressChange = useCallback((id: string) => (progress: number | null) => {
    setMap((prev) => {
      if (progress === null) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: progress };
    });
  }, []);

  return { getProgress, onProgressChange };
}
