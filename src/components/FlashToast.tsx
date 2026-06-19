'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

type Props = {
  message: string;
  variant: 'error' | 'success';
  onDismiss: () => void;
  durationMs?: number;
};

export default function FlashToast({ message, variant, onDismiss, durationMs = 6000 }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [message, onDismiss, durationMs]);

  if (!message || typeof document === 'undefined') return null;

  const styles =
    variant === 'error'
      ? 'bg-red-600 text-white border-red-700 shadow-red-900/20'
      : 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-900/20';

  return createPortal(
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[250] w-[min(100%,28rem)] px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${styles}`}
      >
        <span className="mt-0.5 shrink-0" aria-hidden>
          {variant === 'error'
            ? <AlertTriangle className="w-4 h-4" />
            : <CheckCircle2 className="w-4 h-4" />}
        </span>
        <p className="flex-1 leading-snug">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 opacity-80 hover:opacity-100 p-0.5"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  );
}
