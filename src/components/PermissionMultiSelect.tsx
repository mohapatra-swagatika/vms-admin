'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  loading?: boolean;
  hint?: string;
  variant?: 'allow' | 'deny';
};

function groupOptions(options: string[]) {
  const groups: Record<string, string[]> = {};
  for (const opt of options) {
    const ns = opt.includes(':') ? opt.split(':')[0] : 'other';
    if (!groups[ns]) groups[ns] = [];
    groups[ns].push(opt);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function PermissionMultiSelect({
  label,
  value,
  onChange,
  options,
  loading,
  hint,
  variant = 'allow',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, search]);

  const groups = useMemo(() => groupOptions(filtered), [filtered]);
  const selected = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function toggle(perm: string) {
    if (selected.has(perm)) {
      onChange(value.filter(v => v !== perm));
    } else {
      onChange([...value, perm].sort());
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full min-h-[38px] px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 flex items-center justify-between gap-2"
      >
        <span className="truncate">
          {loading ? (
            <span className="text-gray-400">Loading permissions…</span>
          ) : value.length === 0 ? (
            <span className="text-gray-400">Select permissions…</span>
          ) : (
            <span className="text-gray-800">{value.length} selected</span>
          )}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {value.map(perm => (
            <span
              key={perm}
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono border ${
                variant === 'deny'
                  ? 'bg-danger-light text-danger border-danger-border'
                  : 'bg-success-light text-success border-success-border'
              }`}
            >
              {perm}
              <button
                type="button"
                onClick={() => toggle(perm)}
                className="opacity-60 hover:opacity-100"
                aria-label={`Remove ${perm}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {open && !loading && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search permissions…"
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-2 space-y-3">
            {groups.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-2">No permissions match your search.</p>
            ) : (
              groups.map(([ns, perms]) => (
                <div key={ns}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1 mb-1">
                    {ns}
                  </div>
                  <div className="space-y-0.5">
                    {perms.map(perm => (
                      <label
                        key={perm}
                        className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm font-mono"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(perm)}
                          onChange={() => toggle(perm)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-gray-800">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}
