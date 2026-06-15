'use client';
import { mediaSrc } from '@/lib/api';

type Props = {
  name: string;
  imageUrl?: string | null;
  /** Bust browser cache when the same URL is replaced (e.g. profile re-upload). */
  imageVersion?: number;
  size?: 'sm' | 'md' | 'lg';
};

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
};

export default function EntityAvatar({ name, imageUrl, imageVersion, size = 'md' }: Props) {
  const cls = sizes[size];
  const src = mediaSrc(imageUrl, imageVersion);

  if (src) {
    return (
      <img
        key={`${imageUrl}-${imageVersion ?? 0}`}
        src={src}
        alt=""
        className={`${cls} rounded-full object-cover border border-gray-200 shrink-0 bg-gray-50`}
      />
    );
  }

  return (
    <div
      className={`${cls} rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 font-semibold shrink-0`}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
