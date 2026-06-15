'use client';

type Props = {
  progress: number;
  label?: string;
  roundedClass?: string;
};

export default function UploadProgressOverlay({ progress, label, roundedClass = 'rounded-full' }: Props) {
  const text = label ?? (progress >= 95 ? 'Processing…' : `${progress}%`);

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 ${roundedClass}`}
      role="status"
      aria-live="polite"
      aria-label={`Uploading image, ${progress} percent`}
    >
      <div
        className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin mb-2"
        aria-hidden
      />
      <div className="w-[72%] max-w-[100px] h-1.5 bg-white/25 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <span className="text-white text-[10px] font-semibold mt-1.5 tracking-wide">{text}</span>
    </div>
  );
}
