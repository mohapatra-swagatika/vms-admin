'use client';

import type { ReactNode } from 'react';

export type UploadProgressVariant = 'compact' | 'avatar-lg' | 'panel';

type Props = {
  progress: number;
  variant?: UploadProgressVariant;
  roundedClass?: string;
};

function progressLabel(progress: number): string {
  if (progress >= 95) return 'Saving…';
  if (progress >= 100) return 'Done';
  return `${progress}%`;
}

function ProgressRing({
  progress,
  size,
  stroke = 3,
  trackClass = 'stroke-white/25',
  fillClass = 'stroke-white',
  showLabel = false,
}: {
  progress: number;
  size: number;
  stroke?: number;
  trackClass?: string;
  fillClass?: string;
  showLabel?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, progress) / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={trackClass}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={`${fillClass} transition-[stroke-dashoffset] duration-200 ease-out`}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tabular-nums">
          {progress >= 95 ? '…' : progress}
        </span>
      )}
    </div>
  );
}

function CompactOverlay({ progress, roundedClass }: { progress: number; roundedClass: string }) {
  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center bg-gray-900/45 backdrop-blur-[1px] ${roundedClass}`}
      role="status"
      aria-live="polite"
      aria-label={`Uploading, ${progress} percent`}
    >
      <ProgressRing progress={progress} size={22} stroke={2.5} />
    </div>
  );
}

function AvatarLgOverlay({ progress, roundedClass }: { progress: number; roundedClass: string }) {
  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-gray-900/50 backdrop-blur-[2px] ${roundedClass}`}
      role="status"
      aria-live="polite"
      aria-label={`Uploading, ${progress} percent`}
    >
      <ProgressRing progress={progress} size={40} stroke={3} showLabel />
      <span className="text-[9px] font-medium text-white/90 uppercase tracking-wider">
        {progress >= 95 ? 'Saving' : 'Upload'}
      </span>
    </div>
  );
}

function PanelOverlay({ progress, roundedClass }: { progress: number; roundedClass: string }) {
  const label = progressLabel(progress);

  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col justify-end overflow-hidden ${roundedClass}`}
      role="status"
      aria-live="polite"
      aria-label={`Uploading image, ${progress} percent`}
    >
      <div className="absolute inset-0 bg-gray-900/35 backdrop-blur-[2px]" aria-hidden />

      <div className="relative px-4 pb-4 pt-10 bg-gradient-to-t from-gray-900/80 via-gray-900/50 to-transparent">
        <div className="flex items-center gap-3">
          <ProgressRing
            progress={progress}
            size={36}
            stroke={3}
            trackClass="stroke-white/20"
            fillClass="stroke-primary"
            showLabel
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {progress >= 95 ? 'Processing image…' : 'Uploading image…'}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out shadow-[0_0_8px_rgba(0,123,255,0.5)]"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold text-white tabular-nums shrink-0">{label}</span>
        </div>
      </div>
    </div>
  );
}

export default function UploadProgressOverlay({
  progress,
  variant = 'panel',
  roundedClass = 'rounded-full',
}: Props) {
  if (variant === 'compact') {
    return <CompactOverlay progress={progress} roundedClass={roundedClass} />;
  }
  if (variant === 'avatar-lg') {
    return <AvatarLgOverlay progress={progress} roundedClass={roundedClass} />;
  }
  return <PanelOverlay progress={progress} roundedClass={roundedClass} />;
}

export function UploadButtonProgress({
  uploading,
  progress,
  idleLabel,
}: {
  uploading: boolean;
  progress: number;
  idleLabel: ReactNode;
}) {
  if (!uploading) return <>{idleLabel}</>;

  const label = progress >= 95 ? 'Saving…' : `Uploading ${progress}%`;

  return (
    <span className="flex items-center gap-2 w-full justify-center min-w-0">
      <span className="w-14 h-1 rounded-full bg-primary-border overflow-hidden shrink-0">
        <span
          className="block h-full bg-primary rounded-full transition-[width] duration-200 ease-out"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </span>
      <span className="text-[11px] font-medium tabular-nums truncate">{label}</span>
    </span>
  );
}
