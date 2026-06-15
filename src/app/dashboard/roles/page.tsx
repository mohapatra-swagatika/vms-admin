'use client';
import { Fragment, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import PermissionMultiSelect from '@/components/PermissionMultiSelect';
import Pagination from '@/components/Pagination';

type Role = {
  id: string;
  name: string;
  display_name: string;
  level: number;
  is_system: boolean;
  parent_role_id: string | null;
  permissions: { actions: string[]; not_actions: string[] };
  created_at: string;
  user_count: number;
};

const LEVEL_META: Record<number, { label: string; color: string }> = {
  100:  { label: 'Gate',         color: 'bg-gray-100 text-gray-600' },
  200:  { label: 'Front Desk',   color: 'bg-gray-100 text-gray-600' },
  400:  { label: 'Admin',        color: 'bg-primary-muted text-primary' },
  600:  { label: 'Co/Location',  color: 'bg-primary-muted text-primary' },
  800:  { label: 'Tower/Org',    color: 'bg-primary-muted text-primary' },
  1000: { label: 'Support',      color: 'bg-primary text-white' },
};

function levelMeta(level: number) {
  return LEVEL_META[level] ?? { label: `Level ${level}`, color: 'bg-gray-100 text-gray-600' };
}

export default function RolesPage() {
  const [roles, setRoles]     = useState<Role[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [systemRolesCache, setSystemRolesCache] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'system' | 'custom'>('all');
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ display_name: '', level: '', actions: [] as string[], not_actions: [] as string[] });
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [permsLoading, setPermsLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // Create-role form state
  const [form, setForm] = useState({
    display_name: '',
    name: '',
    level: '300',
    parent_role_id: '',
    actions: [] as string[],
    not_actions: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof api.getRoles>[0] = { page, limit };
      if (search) params.search = search;
      if (filterType === 'system') params.is_system = true;
      if (filterType === 'custom') params.is_system = false;

      const r = await api.getRoles(params);
      setRoles(r.roles ?? []);
      setPagination(r.pagination ?? { page: 1, limit: 20, total: 0, total_pages: 0 });
    } catch { setError('Failed to load roles'); }
    finally { setLoading(false); }
  }, [page, limit, search, filterType]);

  const loadPermissions = useCallback(async () => {
    setPermsLoading(true);
    try {
      const { permissions } = await api.getRolePermissions();
      setAllPermissions(permissions);
    } catch {
      setError('Failed to load permission list');
    } finally {
      setPermsLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadPermissions(); }, [load, loadPermissions]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getRoles({ is_system: true, limit: 100 });
        setSystemRolesCache(r.roles ?? []);
      } catch { /* non-fatal */ }
    })();
  }, []);

  // Auto-generate slug from display name
  function handleDisplayName(v: string) {
    setForm(f => ({
      ...f,
      display_name: v,
      name: v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSuccess('');
    const payload = {
      display_name: form.display_name,
      name: form.name,
      level: parseInt(form.level),
      parent_role_id: form.parent_role_id || null,
      permissions: {
        actions:     form.actions,
        not_actions: form.not_actions,
      },
    };
    try {
      await api.createRole(payload);
      setSuccess(`Role "${form.display_name}" created`);
      setForm({ display_name: '', name: '', level: '300', parent_role_id: '', actions: [], not_actions: [] });
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    }
  }

  function flash(msg: string) {
    setSuccess(msg); setError('');
    setTimeout(() => setSuccess(''), 3500);
  }

  function openEdit(r: Role) {
    setEditingId(r.id);
    setEditForm({
      display_name: r.display_name,
      level:        String(r.level),
      actions:      r.permissions?.actions     ?? [],
      not_actions:  r.permissions?.not_actions ?? [],
    });
    setExpanded(null); // close expand panel if open
  }

  async function handleUpdate(e: React.FormEvent, roleId: string) {
    e.preventDefault(); setError('');
    try {
      await api.updateRole(roleId, {
        display_name: editForm.display_name,
        level:        parseInt(editForm.level),
        permissions: {
          actions:     editForm.actions,
          not_actions: editForm.not_actions,
        },
      });
      flash(`Role "${editForm.display_name}" updated`);
      setEditingId(null);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to update role'); }
  }

  async function handleDelete(r: Role) {
    if (r.user_count > 0) {
      setError(`Cannot delete "${r.display_name}" — ${r.user_count} user(s) still have it assigned. Remove those assignments first.`);
      return;
    }
    if (!confirm(`Permanently delete role "${r.display_name}"?`)) return;
    try {
      await api.deleteRole(r.id);
      flash(`Role "${r.display_name}" deleted`);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to delete role'); }
  }

  const systemRoles = roles.filter(r => r.is_system);
  const customRoles = roles.filter(r => !r.is_system);
  const parentRoles = systemRolesCache.length ? systemRolesCache : systemRoles;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Roles</h1>
          <p className="text-sm text-gray-500">
            {pagination.total} role{pagination.total === 1 ? '' : 's'} total
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          {showForm ? 'Cancel' : '+ Create Custom Role'}
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name or slug…"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {(['all', 'system', 'custom'] as const).map(t => (
            <button key={t} onClick={() => { setFilterType(t); setPage(1); }}
              className={`px-3 py-2 capitalize transition-colors ${
                filterType === t
                  ? 'bg-primary text-white font-medium'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {(searchInput || filterType !== 'all') && (
          <button onClick={() => { setSearchInput(''); setFilterType('all'); setPage(1); }}
            className="text-xs text-primary hover:bg-primary-muted px-3 py-2 rounded-lg border border-primary-border">
            Clear filters
          </button>
        )}
      </div>

      {error   && <div className="mb-4 bg-danger-light border border-danger-border text-danger text-sm px-4 py-2 rounded-lg">{error}</div>}
      {success && <div className="mb-4 bg-success-light border border-success-border text-success text-sm px-4 py-2 rounded-lg">{success}</div>}

      {/* Create Custom Role Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Create Custom Role</h2>
          <p className="text-xs text-gray-400 mb-4">Custom roles inherit from a system role and can override specific permissions.</p>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name *</label>
              <input required value={form.display_name} onChange={e => handleDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Senior Admin" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Slug (auto)</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="senior_admin" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Level *</label>
              <input required type="number" min="1" max="999" value={form.level}
                onChange={e => setForm({...form, level: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="300" />
              <p className="text-xs text-gray-400 mt-0.5">Between system levels. Use gaps: 101–199, 201–399, etc.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Inherits From (parent role)</label>
              <select value={form.parent_role_id} onChange={e => setForm({...form, parent_role_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">-- None --</option>
                {parentRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.display_name} (Level {r.level})</option>
                ))}
              </select>
            </div>
            <PermissionMultiSelect
              label="Allow Actions"
              value={form.actions}
              onChange={actions => setForm({ ...form, actions })}
              options={allPermissions}
              loading={permsLoading}
              hint="Permissions granted to users with this role"
              variant="allow"
            />
            <PermissionMultiSelect
              label="Deny Actions (supersede)"
              value={form.not_actions}
              onChange={not_actions => setForm({ ...form, not_actions })}
              options={allPermissions}
              loading={permsLoading}
              hint="These always win — deny overrides allow"
              variant="deny"
            />
            <div className="col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover">
                Create Role
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading roles...</div>
      ) : (
        <div className="space-y-6">
          {/* System Roles */}
          {filterType !== 'custom' && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">System Roles</div>
            {systemRoles.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-8 text-center text-gray-400 text-sm">
                {searchInput
                  ? <>No system roles match your filters.{' '}
                    <button onClick={() => { setSearchInput(''); setFilterType('all'); setPage(1); }} className="text-primary hover:underline">Clear</button></>
                  : 'No system roles on this page.'}
              </div>
            ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Level</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Permissions</th>
                    <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {systemRoles.map(r => {
                    const meta = levelMeta(r.level);
                    const isOpen = expanded === r.id;
                    const allowCount = r.permissions?.actions?.length ?? 0;
                    const denyCount  = r.permissions?.not_actions?.length ?? 0;
                    return (
                      <Fragment key={r.id}>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-gray-900">{r.display_name}</div>
                            <div className="text-xs text-gray-400 font-mono">{r.name}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                              {meta.label} · {r.level}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs text-success bg-success-light px-2 py-0.5 rounded-full mr-1">
                              ✓ {allowCount} allow
                            </span>
                            {denyCount > 0 && (
                              <span className="text-xs text-danger bg-danger-light px-2 py-0.5 rounded-full">
                                ✕ {denyCount} deny
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button onClick={() => setExpanded(isOpen ? null : r.id)}
                              className="text-xs text-gray-500 hover:text-primary px-2 py-1 rounded hover:bg-gray-100">
                              {isOpen ? 'Hide' : 'View'} permissions
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50">
                            <td colSpan={4} className="px-5 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs font-semibold text-success mb-2">✓ Allowed Actions ({allowCount})</div>
                                  <div className="flex flex-wrap gap-1">
                                    {(r.permissions?.actions ?? []).map(a => (
                                      <span key={a} className="text-xs bg-success-light text-success px-2 py-0.5 rounded font-mono border border-success-border">{a}</span>
                                    ))}
                                    {allowCount === 0 && <span className="text-xs text-gray-400">None</span>}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-danger mb-2">✕ Denied Actions (not_actions) ({denyCount})</div>
                                  <div className="flex flex-wrap gap-1">
                                    {(r.permissions?.not_actions ?? []).map(a => (
                                      <span key={a} className="text-xs bg-danger-light text-danger px-2 py-0.5 rounded font-mono border border-danger-border">{a}</span>
                                    ))}
                                    {denyCount === 0 && <span className="text-xs text-gray-400">None</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
          )}

          {/* Custom Roles */}
          {filterType !== 'system' && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Custom Roles</div>
            {customRoles.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-10 text-center text-gray-400 text-sm">
                {searchInput || filterType !== 'all'
                  ? <>No custom roles match your filters. <button onClick={() => { setSearchInput(''); setFilterType('all'); setPage(1); }} className="text-primary hover:underline">Clear</button></>
                  : 'No custom roles on this page.'}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Level</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Parent</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Permissions</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {customRoles.map(r => {
                      const isOpen    = expanded === r.id;
                      const isEditing = editingId === r.id;
                      const parent    = parentRoles.find(p => p.id === r.parent_role_id)
                        ?? roles.find(p => p.id === r.parent_role_id);
                      const allowCount = r.permissions?.actions?.length ?? 0;
                      const denyCount  = r.permissions?.not_actions?.length ?? 0;
                      return (
                        <Fragment key={r.id}>
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="font-medium text-gray-900">{r.display_name}</div>
                              <div className="text-xs text-gray-400 font-mono">{r.name}</div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-muted text-primary">
                                Custom · {r.level}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              {parent
                                ? <span className="text-xs text-gray-600">{parent.display_name}</span>
                                : <span className="text-xs text-gray-400">—</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-xs text-success bg-success-light px-2 py-0.5 rounded-full mr-1">✓ {allowCount}</span>
                              {denyCount > 0 && <span className="text-xs text-danger bg-danger-light px-2 py-0.5 rounded-full">✕ {denyCount}</span>}
                              {r.user_count > 0 && (
                                <span className="ml-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                  {r.user_count} user{r.user_count > 1 ? 's' : ''}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right space-x-1">
                              <button onClick={() => setExpanded(isOpen ? null : r.id)}
                                className="text-xs text-gray-500 hover:text-primary px-2 py-1 rounded hover:bg-gray-100">
                                {isOpen ? 'Hide' : 'View'}
                              </button>
                              <button onClick={() => isEditing ? setEditingId(null) : openEdit(r)}
                                className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">
                                {isEditing ? 'Cancel' : 'Edit'}
                              </button>
                              <button onClick={() => handleDelete(r)}
                                className={`text-xs px-2 py-1 rounded ${
                                  r.user_count > 0
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-danger hover:bg-danger-light'
                                }`}
                                title={r.user_count > 0 ? `${r.user_count} users assigned — remove first` : 'Delete role'}>
                                Delete
                              </button>
                            </td>
                          </tr>

                          {/* Inline edit form */}
                          {isEditing && (
                            <tr className="bg-primary-muted">
                              <td colSpan={5} className="px-5 py-4">
                                <form onSubmit={e => handleUpdate(e, r.id)} className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                                    <input required value={editForm.display_name}
                                      onChange={e => setEditForm({...editForm, display_name: e.target.value})}
                                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Level</label>
                                    <input required type="number" min="1" max="999" value={editForm.level}
                                      onChange={e => setEditForm({...editForm, level: e.target.value})}
                                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white" />
                                  </div>
                                  <PermissionMultiSelect
                                    label="Allow Actions"
                                    value={editForm.actions}
                                    onChange={actions => setEditForm({ ...editForm, actions })}
                                    options={allPermissions}
                                    loading={permsLoading}
                                    variant="allow"
                                  />
                                  <PermissionMultiSelect
                                    label="Deny Actions"
                                    value={editForm.not_actions}
                                    onChange={not_actions => setEditForm({ ...editForm, not_actions })}
                                    options={allPermissions}
                                    loading={permsLoading}
                                    variant="deny"
                                  />
                                  <div className="col-span-2 flex justify-end gap-2 pt-1">
                                    <button type="button" onClick={() => setEditingId(null)}
                                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                                      Cancel
                                    </button>
                                    <button type="submit"
                                      className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-hover">
                                      Save Changes
                                    </button>
                                  </div>
                                </form>
                              </td>
                            </tr>
                          )}

                          {/* View permissions expand */}
                          {isOpen && !isEditing && (
                            <tr className="bg-gray-50">
                              <td colSpan={5} className="px-5 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-xs font-semibold text-success mb-2">✓ Allowed ({allowCount})</div>
                                    <div className="flex flex-wrap gap-1">
                                      {(r.permissions?.actions ?? []).map(a => (
                                        <span key={a} className="text-xs bg-success-light text-success px-2 py-0.5 rounded font-mono border border-success-border">{a}</span>
                                      ))}
                                      {allowCount === 0 && <span className="text-xs text-gray-400">None</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-danger mb-2">✕ Denied ({denyCount})</div>
                                    <div className="flex flex-wrap gap-1">
                                      {(r.permissions?.not_actions ?? []).map(a => (
                                        <span key={a} className="text-xs bg-danger-light text-danger px-2 py-0.5 rounded font-mono border border-danger-border">{a}</span>
                                      ))}
                                      {denyCount === 0 && <span className="text-xs text-gray-400">None</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {!loading && pagination.total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
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
