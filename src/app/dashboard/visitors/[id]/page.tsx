'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canDeleteVisitor, canUpdateVisitor } from '@/lib/auth';
import {
  visitorsClient,
  ENTITY_TYPE_LABELS,
  VISITOR_STATUS_LABELS,
  VISITOR_STATUS_STYLES,
  VISITOR_ID_TYPE_LABELS,
  type Visitor,
  type VisitorStatus,
  type VisitorIdType,
} from '@/lib/visitors';
import ConfirmDialog from '@/components/ConfirmDialog';
import FlashToast from '@/components/FlashToast';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function toDatetimeLocal(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function VisitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { confirm, dialogProps } = useConfirmDialog();
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
    id_type: '' as '' | VisitorIdType,
    id_number: '',
    purpose: '',
    host_name: '',
    status: 'pending' as VisitorStatus,
    scheduled_arrival: '',
    scheduled_departure: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await visitorsClient.getVisitor(id);
      const v = data.visitor;
      setVisitor(v);
      setForm({
        full_name: v.full_name,
        email: v.email || '',
        phone: v.phone || '',
        company_name: v.company_name || '',
        id_type: v.id_type || '',
        id_number: v.id_number || '',
        purpose: v.purpose || '',
        host_name: v.host_name || '',
        status: v.status,
        scheduled_arrival: toDatetimeLocal(v.scheduled_arrival),
        scheduled_departure: toDatetimeLocal(v.scheduled_departure),
        notes: v.notes || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visitor');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string) {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canUpdateVisitor()) return;
    setSaving(true);
    setError('');
    try {
      const data = await visitorsClient.updateVisitor(id, {
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        company_name: form.company_name || null,
        id_type: form.id_type || null,
        id_number: form.id_number || null,
        purpose: form.purpose || null,
        host_name: form.host_name || null,
        status: form.status,
        scheduled_arrival: form.scheduled_arrival ? new Date(form.scheduled_arrival).toISOString() : null,
        scheduled_departure: form.scheduled_departure ? new Date(form.scheduled_departure).toISOString() : null,
        notes: form.notes || null,
      });
      setVisitor(data.visitor);
      setEditing(false);
      flash('Visitor updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visitor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!canDeleteVisitor()) return;
    const ok = await confirm({
      title: 'Delete visitor',
      message: `Delete visitor "${visitor?.full_name}"? This cannot be undone.`,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await visitorsClient.deleteVisitor(id);
      router.push('/dashboard/visitors');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete visitor');
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-gray-400 text-sm">Loading visitor…</div>;
  }

  if (!visitor) {
    return (
      <div className="p-8">
        <Link href="/dashboard/visitors" className="text-sm text-primary hover:underline">← Back to Visitors</Link>
        <p className="mt-4 text-danger">{error || 'Visitor not found'}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/dashboard/visitors" className="text-sm text-primary hover:underline">← Back to Visitors</Link>

      <div className="mt-4 mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Sample data mode — changes are stored locally until the API is connected.
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{visitor.full_name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {ENTITY_TYPE_LABELS[visitor.entity_type]} · {visitor.entity_name || visitor.entity_id.slice(0, 8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full ${VISITOR_STATUS_STYLES[visitor.status]}`}>
            {VISITOR_STATUS_LABELS[visitor.status]}
          </span>
          {canUpdateVisitor() && !editing && (
            <button onClick={() => setEditing(true)}
              className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-3 py-1.5 rounded-lg">
              Edit
            </button>
          )}
          {canDeleteVisitor() && (
            <button onClick={handleDelete} disabled={deleting}
              className="text-xs text-danger hover:bg-danger-light border border-danger-border px-3 py-1.5 rounded-lg disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-6 bg-white rounded-2xl border border-gray-200 p-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
            <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as VisitorStatus })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {(Object.keys(VISITOR_STATUS_LABELS) as VisitorStatus[]).map(s => (
                <option key={s} value={s}>{VISITOR_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Visitor Company</label>
            <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Host Name</label>
            <input value={form.host_name} onChange={e => setForm({ ...form, host_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ID Type</label>
            <select value={form.id_type} onChange={e => setForm({ ...form, id_type: e.target.value as '' | VisitorIdType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Not specified</option>
              {(Object.keys(VISITOR_ID_TYPE_LABELS) as VisitorIdType[]).map(t => (
                <option key={t} value={t}>{VISITOR_ID_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ID Number</label>
            <input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Purpose</label>
            <input value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Scheduled Arrival</label>
            <input type="datetime-local" value={form.scheduled_arrival}
              onChange={e => setForm({ ...form, scheduled_arrival: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Scheduled Departure</label>
            <input type="datetime-local" value={form.scheduled_departure}
              onChange={e => setForm({ ...form, scheduled_departure: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          <DetailRow label="Email" value={visitor.email} />
          <DetailRow label="Phone" value={visitor.phone} />
          <DetailRow label="Visitor company" value={visitor.company_name} />
          <DetailRow label="Host" value={visitor.host_name} />
          <DetailRow label="Purpose" value={visitor.purpose} />
          <DetailRow
            label="ID"
            value={visitor.id_type
              ? `${VISITOR_ID_TYPE_LABELS[visitor.id_type]}${visitor.id_number ? ` · ${visitor.id_number}` : ''}`
              : visitor.id_number}
          />
          <DetailRow label="Scheduled arrival" value={formatDateTime(visitor.scheduled_arrival)} />
          <DetailRow label="Scheduled departure" value={formatDateTime(visitor.scheduled_departure)} />
          <DetailRow label="Checked in" value={formatDateTime(visitor.checked_in_at)} />
          <DetailRow label="Checked out" value={formatDateTime(visitor.checked_out_at)} />
          <DetailRow label="Notes" value={visitor.notes} />
          <DetailRow label="Created" value={formatDateTime(visitor.created_at)} />
          <DetailRow label="Updated" value={formatDateTime(visitor.updated_at)} />
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
      <FlashToast message={error} variant="error" onDismiss={() => setError('')} />
      <FlashToast message={success} variant="success" onDismiss={() => setSuccess('')} />
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
