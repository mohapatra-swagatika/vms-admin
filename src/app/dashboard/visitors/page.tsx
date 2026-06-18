'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  canCreateVisitor,
  canReadVisitors,
  getScopedEntity,
  getTopScope,
  isSupport,
  getVisibleVisitorEntityTypes,
  type ScopedEntityType,
} from '@/lib/auth';
import {
  visitorsClient,
  remapMockVisitorsToEntities,
  ENTITY_TYPE_LABELS,
  VISITOR_STATUS_LABELS,
  VISITOR_STATUS_STYLES,
  VISITOR_ID_TYPE_LABELS,
  type Visitor,
  type VisitorStatus,
  type VisitorIdType,
} from '@/lib/visitors';
import Pagination from '@/components/Pagination';
import FlashToast from '@/components/FlashToast';

type EntityOption = { id: string; name: string; type: ScopedEntityType };
type EntityTypeFilter = '' | ScopedEntityType;
type StatusFilter = '' | VisitorStatus;

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function VisitorsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('');
  const [filterEntityType, setFilterEntityType] = useState<EntityTypeFilter>('');
  const [filterEntityId, setFilterEntityId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [visibleEntityTypes, setVisibleEntityTypes] = useState<ScopedEntityType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entity_type: '' as EntityTypeFilter,
    entity_id: '',
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
    id_type: '' as '' | VisitorIdType,
    id_number: '',
    purpose: '',
    host_name: '',
    scheduled_arrival: '',
    scheduled_departure: '',
    notes: '',
  });

  const loadEntities = useCallback(async () => {
    try {
      const top = getTopScope();
      const support = isSupport();
      const st = top?.scope_type ?? 'global';
      const options: EntityOption[] = [];

      if (support || st === 'tower') {
        const { towers } = await api.getTowers();
        towers.forEach((t: { id: string; name: string }) => options.push({ id: t.id, name: t.name, type: 'tower' }));
        const { companies } = await api.getCompanies();
        companies.forEach((c: { id: string; name: string }) => options.push({ id: c.id, name: c.name, type: 'company' }));
      } else if (st === 'organization') {
        const { organizations } = await api.getOrganizations();
        organizations.forEach((o: { id: string; name: string }) => options.push({ id: o.id, name: o.name, type: 'organization' }));
        const { locations } = await api.getLocations();
        locations.forEach((l: { id: string; name: string }) => options.push({ id: l.id, name: l.name, type: 'location' }));
      } else if (st === 'company') {
        const { companies } = await api.getCompanies();
        companies.forEach((c: { id: string; name: string }) => options.push({ id: c.id, name: c.name, type: 'company' }));
      } else if (st === 'location') {
        const { locations } = await api.getLocations();
        locations.forEach((l: { id: string; name: string }) => options.push({ id: l.id, name: l.name, type: 'location' }));
      }

      setEntityOptions(options);
      remapMockVisitorsToEntities(options);

      const scoped = getScopedEntity();
      if (scoped && !support) {
        setFilterEntityType(scoped.type);
        setFilterEntityId(scoped.id);
        setForm(f => ({ ...f, entity_type: scoped.type, entity_id: scoped.id }));
      }
    } catch { /* non-fatal for mock module */ }
  }, []);

  const load = useCallback(async () => {
    if (!mounted || !canReadVisitors()) return;
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof visitorsClient.listVisitors>[0] = {
        page,
        limit,
        search: search || undefined,
      };
      if (filterEntityType) {
        params.entity_type = filterEntityType;
        if (filterEntityId) {
          const selected = entityOptions.find(e => e.id === filterEntityId);
          if (selected) {
            params.entity_type = selected.type;
            params.entity_id = selected.id;
          } else {
            params.entity_id = filterEntityId;
          }
        }
      }
      if (filterStatus) params.status = filterStatus;

      const data = await visitorsClient.listVisitors(params);
      setVisitors(data.visitors ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, total_pages: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visitors');
    } finally {
      setLoading(false);
    }
  }, [mounted, entityOptions, page, limit, search, filterStatus, filterEntityType, filterEntityId]);

  useEffect(() => {
    setMounted(true);
    setVisibleEntityTypes(getVisibleVisitorEntityTypes());
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    if (!mounted || !visibleEntityTypes.length) return;
    if (filterEntityType && !visibleEntityTypes.includes(filterEntityType)) {
      setFilterEntityType('');
      setFilterEntityId('');
    }
    if (form.entity_type && !visibleEntityTypes.includes(form.entity_type)) {
      setForm(f => ({ ...f, entity_type: '', entity_id: '' }));
    }
  }, [mounted, visibleEntityTypes, filterEntityType, form.entity_type]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function entityFilterOptions(): EntityOption[] {
    if (!filterEntityType) return entityOptions;
    return entityOptions.filter(e => e.type === filterEntityType);
  }

  function entityFilterAllLabel(): string {
    if (filterEntityType) return `All ${ENTITY_TYPE_LABELS[filterEntityType]}s`;
    return 'All entities';
  }

  function formEntityOptions(): EntityOption[] {
    if (!form.entity_type) return entityOptions;
    return entityOptions.filter(e => e.type === form.entity_type);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.entity_type || !form.entity_id) {
      setError('Select an entity for this visitor.');
      return;
    }
    try {
      await visitorsClient.createVisitor({
        entity_type: form.entity_type,
        entity_id: form.entity_id,
        full_name: form.full_name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company_name: form.company_name || undefined,
        id_type: form.id_type || undefined,
        id_number: form.id_number || undefined,
        purpose: form.purpose || undefined,
        host_name: form.host_name || undefined,
        scheduled_arrival: form.scheduled_arrival ? new Date(form.scheduled_arrival).toISOString() : undefined,
        scheduled_departure: form.scheduled_departure ? new Date(form.scheduled_departure).toISOString() : undefined,
        notes: form.notes || undefined,
      });
      setSuccess(`Visitor ${form.full_name} registered`);
      setShowForm(false);
      setForm(f => ({
        ...f,
        full_name: '', email: '', phone: '', company_name: '', id_type: '',
        id_number: '', purpose: '', host_name: '', scheduled_arrival: '',
        scheduled_departure: '', notes: '',
      }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visitor');
    }
  }

  if (mounted && !canReadVisitors()) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold text-gray-900">Visitors</h1>
        <p className="text-sm text-gray-500 mt-2">You do not have permission to view visitors.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Sample data mode — visitor records are stored locally until the API is connected. The database schema is ready for integration.
      </div>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Visitors</h1>
          <p className="text-sm text-gray-500">
            {pagination.total} visitor{pagination.total === 1 ? '' : 's'} total
          </p>
        </div>
        {mounted && canCreateVisitor() && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            {showForm ? 'Cancel' : '+ Register Visitor'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, host, company…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={filterEntityType}
          onChange={e => {
            setFilterEntityType(e.target.value as EntityTypeFilter);
            setFilterEntityId('');
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All entity types</option>
          {visibleEntityTypes.map(t => (
            <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={filterEntityId}
          onChange={e => { setFilterEntityId(e.target.value); setPage(1); }}
          disabled={!filterEntityType}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50 min-w-[160px]"
        >
          <option value="">{entityFilterAllLabel()}</option>
          {entityFilterOptions().map(e => (
            <option key={`${e.type}-${e.id}`} value={e.id}>{e.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value as StatusFilter); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All statuses</option>
          {(Object.keys(VISITOR_STATUS_LABELS) as VisitorStatus[]).map(s => (
            <option key={s} value={s}>{VISITOR_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {showForm && mounted && canCreateVisitor() && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Register Visitor</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type *</label>
              <select
                required
                value={form.entity_type}
                onChange={e => setForm({ ...form, entity_type: e.target.value as EntityTypeFilter, entity_id: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select type</option>
                {visibleEntityTypes.map(t => (
                  <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Entity *</label>
              <select
                required
                value={form.entity_id}
                onChange={e => setForm({ ...form, entity_id: e.target.value })}
                disabled={!form.entity_type}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50"
              >
                <option value="">Select entity</option>
                {formEntityOptions().map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
              <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Visitor Company</label>
              <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
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
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Host Name</label>
              <input value={form.host_name} onChange={e => setForm({ ...form, host_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
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
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover">
                Register Visitor
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading visitors…</div>
      ) : visitors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center text-gray-400 text-sm">
          No visitors found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Visitor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Host</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Arrival</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map(v => (
                <tr
                  key={v.id}
                  onClick={() => router.push(`/dashboard/visitors/${v.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{v.full_name}</div>
                    <div className="text-xs text-gray-500">{v.company_name || v.email || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.host_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="text-xs text-gray-400">{ENTITY_TYPE_LABELS[v.entity_type]}</span>
                    {' · '}
                    {v.entity_name || v.entity_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDateTime(v.scheduled_arrival)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${VISITOR_STATUS_STYLES[v.status]}`}>
                      {VISITOR_STATUS_LABELS[v.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            pagination={pagination}
            onPageChange={setPage}
            onLimitChange={next => { setLimit(next); setPage(1); }}
          />
        </div>
      )}
      <FlashToast message={error} variant="error" onDismiss={() => setError('')} />
      <FlashToast message={success} variant="success" onDismiss={() => setSuccess('')} />
    </div>
  );
}
