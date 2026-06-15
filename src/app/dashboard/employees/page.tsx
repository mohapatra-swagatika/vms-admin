'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Employee } from '@/lib/api';
import {
  canCreateEmployee, canReadEmployees, getScopedEntity, getTopScope, isSupport,
  getVisibleEmployeeEntityTypes,
  type ScopedEntityType,
} from '@/lib/auth';
import EmployeeCsvUploadButton from '@/components/EmployeeCsvUploadButton';
import Pagination from '@/components/Pagination';

type EntityOption = { id: string; name: string; type: ScopedEntityType };
type EntityTypeFilter = '' | ScopedEntityType;

const ENTITY_LABELS: Record<ScopedEntityType, string> = {
  tower: 'Tower',
  company: 'Company',
  organization: 'Organization',
  location: 'Location',
};

export default function EmployeesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterDepartment, setFilterDepartment] = useState('');
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
    name: '',
    email: '',
    phone: '',
    employee_code: '',
    department: '',
    job_title: '',
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

      const scoped = getScopedEntity();
      if (scoped && !support) {
        setForm(f => ({ ...f, entity_type: scoped.type, entity_id: scoped.id }));
      }
    } catch { /* non-fatal */ }
  }, []);

  const load = useCallback(async () => {
    if (!mounted || !canReadEmployees()) return;
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof api.getEmployees>[0] = {
        page,
        limit,
        search: search || undefined,
        department: filterDepartment || undefined,
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
      if (filterStatus === 'active') params.is_active = true;
      if (filterStatus === 'inactive') params.is_active = false;

      const data = await api.getEmployees(params);
      setEmployees(data.employees ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, total_pages: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [mounted, entityOptions, page, limit, search, filterDepartment, filterStatus, filterEntityType, filterEntityId]);

  useEffect(() => {
    setMounted(true);
    const types = getVisibleEmployeeEntityTypes();
    setVisibleEntityTypes(types);
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
    if (filterEntityType) return `All ${ENTITY_LABELS[filterEntityType]}s`;
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
      setError('Select an entity for this employee.');
      return;
    }
    try {
      await api.createEmployee({
        entity_type: form.entity_type,
        entity_id: form.entity_id,
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        employee_code: form.employee_code || undefined,
        department: form.department || undefined,
        job_title: form.job_title || undefined,
      });
      setSuccess(`Employee ${form.name} created`);
      setShowForm(false);
      setForm(f => ({
        ...f,
        name: '', email: '', phone: '', employee_code: '', department: '', job_title: '',
      }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    }
  }

  const scoped = getScopedEntity();
  const csvTarget = filterEntityType && filterEntityId
    ? { type: filterEntityType as ScopedEntityType, id: filterEntityId }
    : scoped;

  if (mounted && !canReadEmployees()) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold text-gray-900">Employees</h1>
        <p className="text-sm text-gray-500 mt-2">You do not have permission to view employees.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500">
            {pagination.total} employee{pagination.total === 1 ? '' : 's'} total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {csvTarget && (
            <EmployeeCsvUploadButton
              mode="self"
              entityType={csvTarget.type}
              entityId={csvTarget.id}
              showTemplateLink
              onImported={() => load()}
              className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            />
          )}
          {mounted && canCreateEmployee() && (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              {showForm ? 'Cancel' : '+ Create Employee'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, email, code…"
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
            <option key={t} value={t}>{ENTITY_LABELS[t]}</option>
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

        <input
          value={filterDepartment}
          onChange={e => { setFilterDepartment(e.target.value); setPage(1); }}
          placeholder="Department"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-36"
        />

        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value as typeof filterStatus); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      {error && <div className="mb-4 bg-danger-light border border-danger-border text-danger text-sm px-4 py-2 rounded-lg">{error}</div>}
      {success && <div className="mb-4 bg-success-light border border-success-border text-success text-sm px-4 py-2 rounded-lg">{success}</div>}

      {showForm && mounted && canCreateEmployee() && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Create Employee</h2>
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
                  <option key={t} value={t}>{ENTITY_LABELS[t]}</option>
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
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Employee Code</label>
              <input value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
              <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Job Title</label>
              <input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover">
                Create Employee
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading employees…</div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center text-gray-400 text-sm">
          No employees found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr
                  key={emp.id}
                  onClick={() => router.push(`/dashboard/employees/${emp.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.employee_code || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="text-xs text-gray-400">{ENTITY_LABELS[emp.entity_type]}</span>
                    {' · '}
                    {emp.entity_name || emp.entity_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.is_active ? 'bg-success-light text-success' : 'bg-gray-100 text-gray-500'}`}>
                      {emp.is_active ? 'Active' : 'Inactive'}
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
    </div>
  );
}
