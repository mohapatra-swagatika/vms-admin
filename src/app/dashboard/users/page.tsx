'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import Pagination from '@/components/Pagination';

type User = { id: string; email: string; name: string; phone?: string; is_active: boolean; created_at: string; roles: Role[] };
type Role = { role_name: string; display_name: string; level: number; scope_type: string; scope_id: string | null; expires_at?: string };
type RoleDef = { id: string; name: string; display_name: string; level: number; is_system: boolean };

type Entity = { id: string; name: string; tower_name?: string; organization_name?: string };
type ScopeType = 'global' | 'tower' | 'organization' | 'company' | 'location';

export default function UsersPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  useEffect(() => { setCurrentUserId(getUser()?.id); }, []);
  const [users, setUsers]     = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [roleFilterOptions, setRoleFilterOptions] = useState<string[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<RoleDef[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [maxAssignableLevel, setMaxAssignableLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // Entity caches for scope_id dropdown
  const [towers, setTowers]       = useState<Entity[]>([]);
  const [orgs, setOrgs]           = useState<Entity[]>([]);
  const [companies, setCompanies] = useState<Entity[]>([]);
  const [locations, setLocations] = useState<Entity[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    role_name: '', scope_type: 'global' as ScopeType, scope_id: '',
  });

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterRole, setFilterRole] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof api.getUsers>[0] = { page, limit };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterStatus === 'active') params.is_active = true;
      if (filterStatus === 'inactive') params.is_active = false;

      const u = await api.getUsers(params);
      setUsers(u.users ?? []);
      setPagination(u.pagination ?? { page: 1, limit: 20, total: 0, total_pages: 0 });
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, [page, limit, search, filterStatus, filterRole]);

  const loadAssignableRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const r = await api.getAssignableRoles();
      setAssignableRoles(r.roles ?? []);
      setMaxAssignableLevel(r.max_assignable_level ?? null);
      setForm(f => (f.role_name && !(r.roles ?? []).some((role: RoleDef) => role.name === f.role_name))
        ? { ...f, role_name: '' }
        : f);
    } catch {
      setAssignableRoles([]);
      setMaxAssignableLevel(null);
      setError('Failed to load assignable roles');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getRoles({ limit: 100 });
        const names = (r.roles ?? []).map((role: RoleDef) => role.display_name).sort();
        setRoleFilterOptions(names);
      } catch { /* non-fatal */ }
    })();
  }, []);

  useEffect(() => {
    if (showForm) loadAssignableRoles();
  }, [showForm, loadAssignableRoles]);

  // Lazy-load entities the first time the form opens, for the scope picker
  useEffect(() => {
    if (!showForm || towers.length || orgs.length) return;
    (async () => {
      try {
        const [t, o, c, l] = await Promise.all([
          api.getTowers(), api.getOrganizations(),
          api.getCompanies(), api.getLocations(),
        ]);
        setTowers(t.towers); setOrgs(o.organizations);
        setCompanies(c.companies); setLocations(l.locations);
      } catch { /* non-fatal — scope picker just stays empty */ }
    })();
  }, [showForm, towers.length, orgs.length]);

  // Reset scope_id whenever scope_type changes
  function setScopeType(scope_type: ScopeType) {
    setForm(f => ({ ...f, scope_type, scope_id: '' }));
  }

  function scopeOptions(): Entity[] {
    switch (form.scope_type) {
      case 'tower':        return towers;
      case 'organization': return orgs;
      case 'company':      return companies;
      case 'location':     return locations;
      default:             return [];
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSuccess('');

    if (form.role_name && form.scope_type !== 'global' && !form.scope_id) {
      setError(`Pick which ${form.scope_type} this role applies to.`);
      return;
    }

    try {
      const payload = {
        name: form.name, email: form.email, password: form.password, phone: form.phone,
        role_name: form.role_name || undefined,
        scope_type: form.role_name ? form.scope_type : undefined,
        scope_id:   form.role_name && form.scope_type !== 'global' ? form.scope_id : undefined,
      };
      await api.createUser(payload);
      setSuccess(`User ${form.name} created successfully`);
      setForm({ name: '', email: '', password: '', phone: '', role_name: '', scope_type: 'global', scope_id: '' });
      setShowForm(false); load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  }

  async function toggleActive(user: User) {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      load();
    } catch { setError('Failed to update user'); }
  }

  // Build a lookup so we can show scope NAMES, not just IDs, on the user rows.
  // Always load entities (even when form is closed) so the table is correct.
  useEffect(() => {
    (async () => {
      try {
        const [t, o, c, l] = await Promise.all([
          api.getTowers(), api.getOrganizations(),
          api.getCompanies(), api.getLocations(),
        ]);
        setTowers(t.towers); setOrgs(o.organizations);
        setCompanies(c.companies); setLocations(l.locations);
      } catch { /* non-fatal */ }
    })();
  }, []);

  function scopeName(scope_type: string, scope_id: string | null): string {
    if (scope_type === 'global' || !scope_id) return '';
    const all: Entity[] =
      scope_type === 'tower'        ? towers :
      scope_type === 'organization' ? orgs :
      scope_type === 'company'      ? companies :
      scope_type === 'location'     ? locations : [];
    return all.find(e => e.id === scope_id)?.name || scope_id.slice(0, 8);
  }

  const levelColor = (level: number) => {
    if (level >= 1000) return 'bg-primary text-white';
    if (level >= 400) return 'bg-primary-muted text-primary';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">
            {pagination.total} user{pagination.total === 1 ? '' : 's'} total
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          {showForm ? 'Cancel' : '+ Create User'}
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name or email…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>

        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as typeof filterStatus); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white">
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>

        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white">
          <option value="">All roles</option>
          {roleFilterOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {(searchInput || filterStatus !== 'all' || filterRole) && (
          <button onClick={() => { setSearchInput(''); setFilterStatus('all'); setFilterRole(''); setPage(1); }}
            className="text-xs text-primary hover:bg-primary-muted px-3 py-2 rounded-lg border border-primary-border">
            Clear filters
          </button>
        )}
      </div>

      {error   && <div className="mb-4 bg-danger-light border border-danger-border text-danger text-sm px-4 py-2 rounded-lg">{error}</div>}
      {success && <div className="mb-4 bg-success-light border border-success-border text-success text-sm px-4 py-2 rounded-lg">{success}</div>}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Create New User</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="john@company.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
              <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assign Role</label>
              <select
                value={form.role_name}
                onChange={e => setForm({ ...form, role_name: e.target.value })}
                disabled={rolesLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50"
              >
                <option value="">{rolesLoading ? 'Loading roles…' : '-- No role --'}</option>
                {assignableRoles.map(r => (
                  <option key={r.id} value={r.name}>{r.display_name} (Level {r.level})</option>
                ))}
              </select>
              {maxAssignableLevel != null && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Only roles at or below level {maxAssignableLevel} (below your level).
                </p>
              )}
              {!rolesLoading && assignableRoles.length === 0 && (
                <p className="text-xs text-warning mt-0.5">No roles below your level are available to assign.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Scope Type</label>
              <select value={form.scope_type} onChange={e => setScopeType(e.target.value as ScopeType)}
                disabled={!form.role_name}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400">
                <option value="global">Global (everywhere)</option>
                <option value="tower">Tower</option>
                <option value="organization">Organization</option>
                <option value="company">Company</option>
                <option value="location">Location</option>
              </select>
              {!form.role_name && (
                <p className="text-xs text-gray-400 mt-0.5">Pick a role above first</p>
              )}
            </div>

            {form.role_name && form.scope_type !== 'global' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Which {form.scope_type}? *
                </label>
                <select required value={form.scope_id}
                  onChange={e => setForm({...form, scope_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">-- Select {form.scope_type} --</option>
                  {scopeOptions().map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.tower_name        ? ` (in ${o.tower_name})` : ''}
                      {o.organization_name ? ` (in ${o.organization_name})` : ''}
                    </option>
                  ))}
                </select>
                {scopeOptions().length === 0 && (
                  <p className="text-xs text-warning mt-0.5">
                    No {form.scope_type}s exist yet. Create one on the Entities page first.
                  </p>
                )}
              </div>
            )}
            <div className="col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover">
                Create User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading users...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[20%]">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[13%]">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[12%]">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]">Scope</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[8%]">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[8%]">Joined</th>
                <th className="px-4 py-3 w-[8%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => {
                // Primary role = highest level; show "+N" if multiple
                const sorted = [...u.roles].sort((a, b) => b.level - a.level);
                const primary = sorted[0] ?? null;
                const extraCount = sorted.length - 1;
                const scope = primary ? scopeName(primary.scope_type, primary.scope_id) : '';
                const scopeLabel =
                  primary?.scope_type === 'global' ? 'Global'
                  : primary?.scope_type ? `${primary.scope_type.charAt(0).toUpperCase() + primary.scope_type.slice(1)}`
                  : '';

                return (
                  <tr key={u.id}
                    onClick={() => router.push(`/dashboard/users/${u.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group">

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 leading-tight">{u.name}</div>
                      {u.id === currentUserId && (
                        <span className="text-[10px] text-primary font-medium">You</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      <div className="text-gray-600 text-xs">{u.email}</div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3">
                      <div className="text-gray-500 text-xs">{u.phone || <span className="text-gray-300">—</span>}</div>
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-3">
                      {primary ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColor(primary.level)}`}>
                            {primary.display_name}
                          </span>
                          {extraCount > 0 && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              +{extraCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">No role</span>
                      )}
                    </td>

                    {/* Scope */}
                    <td className="px-4 py-3">
                      {primary ? (
                        <div className="text-xs text-gray-600 leading-tight">
                          {scope
                            ? <><span className="text-gray-400">{scopeLabel} · </span>{scope}</>
                            : <span className="text-gray-400 italic">{scopeLabel || '—'}</span>
                          }
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.is_active ? 'bg-success-light text-success' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-success' : 'bg-gray-400'}`}></span>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {u.id !== currentUserId ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleActive(u); }}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            u.is_active
                              ? 'text-danger border-danger-border hover:bg-danger-light'
                              : 'text-success border-success-border hover:bg-success-light'
                          }`}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && users.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              {(search || filterStatus !== 'all' || filterRole)
                ? <>No users match your filters.{' '}
                  <button onClick={() => { setSearchInput(''); setFilterStatus('all'); setFilterRole(''); setPage(1); }}
                    className="text-primary hover:underline">Clear filters</button></>
                : 'No users yet. Create the first one.'}
            </div>
          )}
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
