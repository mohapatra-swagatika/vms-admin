'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import {
  visitorsClient,
  ENTITY_TYPE_LABELS,
  VISITOR_STATUS_LABELS,
  VISITOR_STATUS_STYLES,
  type Visitor,
} from '@/lib/visitors';
import FlashToast from '@/components/FlashToast';
import EntityAvatar from '@/components/EntityAvatar';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { mediaSrc } from '@/lib/api';

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function VisitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await visitorsClient.getVisitor(id);
      setVisitor(data.visitor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visitor');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="p-8 text-gray-400 text-sm">Loading visitor…</div>;
  }

  if (!visitor) {
    return (
      <div className="p-8">
        <Link href="/dashboard/visitors" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
          Back to Visitors
        </Link>
        <p className="mt-4 text-danger">{error || 'Visitor not found'}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/dashboard/visitors" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
        Back to Visitors
      </Link>

      <div className="mt-4 mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Sample data mode — visitor records are read-only until the API is connected.
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mt-6">
        <div className="flex items-start gap-4 min-w-0">
          <button
            type="button"
            onClick={() => visitor.image_url && setLightbox(true)}
            disabled={!visitor.image_url}
            className={`shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              visitor.image_url ? 'cursor-zoom-in hover:opacity-95' : 'cursor-default'
            }`}
            title={visitor.image_url ? 'View photo' : undefined}
          >
            <EntityAvatar name={visitor.full_name} imageUrl={visitor.image_url} size="xl" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{visitor.full_name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {ENTITY_TYPE_LABELS[visitor.entity_type]} · {visitor.entity_name || visitor.entity_id.slice(0, 8)}
            </p>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full ${VISITOR_STATUS_STYLES[visitor.status]}`}>
          {VISITOR_STATUS_LABELS[visitor.status]}
        </span>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        <DetailRow label="Email" value={visitor.email} />
        <DetailRow label="Phone" value={visitor.phone} />
        <DetailRow label="Purpose" value={visitor.purpose} />
        <DetailRow label="Host name" value={visitor.host_name} />
        {visitor.host_email && <DetailRow label="Host email" value={visitor.host_email} />}
        <DetailRow label="Entity type" value={ENTITY_TYPE_LABELS[visitor.entity_type]} />
        <DetailRow label="Entity" value={visitor.entity_name || visitor.entity_id} />
        <DetailRow label="Status" value={VISITOR_STATUS_LABELS[visitor.status]} />
        <DetailRow label="Checked in" value={formatDateTime(visitor.checked_in_at)} />
        <DetailRow label="Checked out" value={formatDateTime(visitor.checked_out_at)} />
      </div>

      <ImagePreviewModal
        open={lightbox && !!visitor.image_url}
        src={mediaSrc(visitor.image_url) ?? ''}
        alt={`${visitor.full_name} — visitor photo`}
        onClose={() => setLightbox(false)}
      />
      <FlashToast message={error} variant="error" onDismiss={() => setError('')} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="px-6 py-4 flex flex-col sm:flex-row sm:gap-6">
      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 mt-1 sm:mt-0">{value || '—'}</dd>
    </div>
  );
}
