'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
};

export default function ImagePreviewModal({ open, src, alt, onClose }: Props) {
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close preview"
      />

      <button
        type="button"
        onClick={onClose}
        className="fixed top-4 right-4 z-[210] w-10 h-10 rounded-full bg-white text-gray-800 hover:bg-gray-100 shadow-lg flex items-center justify-center text-xl leading-none transition-colors"
        aria-label="Close"
      >
        ×
      </button>

      <div className="relative z-10 flex flex-col items-center max-w-[min(100%,56rem)] w-full max-h-[90vh]">
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[calc(90vh-3rem)] w-auto h-auto object-contain rounded-lg shadow-2xl bg-black/20"
          onClick={e => e.stopPropagation()}
        />

        <p className="mt-3 text-sm text-white/90 text-center truncate max-w-full px-2">{alt}</p>
      </div>
    </div>,
    document.body,
  );
}
