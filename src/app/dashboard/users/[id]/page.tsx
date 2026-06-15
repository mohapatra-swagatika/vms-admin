'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, profileImageSrc } from '@/lib/api';
import { getUser } from '@/lib/auth';
import ConfirmDialog from '@/components/ConfirmDialog';
import FlashToast from '@/components/FlashToast';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

type User = {
  id: string; email: string; name: string; phone: string | null;
  is_active: boolean; created_at: string; profile_image_url?: string | null;
};
type Assignment = {
  id: string; scope_type: string; scope_id: string | null;
  assigned_at: string; expires_at: string | null;
  role_name: string; display_name: string; level: number; is_system: boolean;
};
type RoleDef = { id: string; name: string; display_name: string; level: number; is_system: boolean };
type Entity  = { id: string; name: string };
type ScopeType = 'global' | 'tower' | 'organization' | 'company' | 'location';

const levelColor = (level: number) => {
  if (level >= 800) return 'bg-red-100 text-red-700';
  if (level >= 600) return 'bg-blue-100 text-blue-700';
  if (level >= 400) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
};

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { confirm, dialogProps } = useConfirmDialog();
  const [isSelf, setIsSelf] = useState(false);
  useEffect(() => { setIsSelf(getUser()?.id === id); }, [id]);

  const [user, setUser]               = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [roles, setRoles]             = useState<RoleDef[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [maxAssignableLevel, setMaxAssignableLevel] = useState<number | null>(null);
  const [towers, setTowers]           = useState<Entity[]>([]);
  const [orgs, setOrgs]               = useState<Entity[]>([]);
  const [companies, setCompanies]     = useState<Entity[]>([]);
  const [locations, setLocations]     = useState<Entity[]>([]);

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // Profile edit
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [editingProfile, setEditingProfile] = useState(false);

  // Password reset modal
  const [showReset, setShowReset] = useState(false);
  const [resetPwd, setResetPwd]   = useState('');
  const [newPwd, setNewPwd]       = useState('');

  // Add role
  const [showAddRole, setShowAddRole] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    role_id: '', scope_type: 'global' as ScopeType, scope_id: '', expires_at: '',
  });

  const load = useCallback(async () => {
    try {
      const [u, ur, t, o, c, l] = await Promise.all([
        api.getUser(id),
        api.getUserRoles(id),
        api.getTowers(),
        api.getOrganizations(),
        api.getCompanies(),
        api.getLocations(),
      ]);
      setUser(u);
      setProfile({ name: u.name, email: u.email, phone: u.phone || '' });
      setAssignments(ur.assignments);
      setTowers(t.towers); setOrgs(o.organizations);
      setCompanies(c.companies); setLocations(l.locations);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showAddRole) return;
    setRolesLoading(true);
    api.getAssignableRoles()
      .then(r => {
        setRoles(r.roles ?? []);
        setMaxAssignableLevel(r.max_assignable_level ?? null);
      })
      .catch(() => {
        setRoles([]);
        setMaxAssignableLevel(null);
        setError('Failed to load assignable roles');
      })
      .finally(() => setRolesLoading(false));
  }, [showAddRole]);

  function flash(msg: string) {
    setSuccess(msg); setError('');
    setTimeout(() => setSuccess(''), 4000);
  }

  function scopeName(scope_type: string, scope_id: string | null): string {
    if (scope_type === 'global' || !scope_id) return '';
    const list: Entity[] =
      scope_type === 'tower'        ? towers :
      scope_type === 'organization' ? orgs :
      scope_type === 'company'      ? companies :
      scope_type === 'location'     ? locations : [];
    return list.find(e => e.id === scope_id)?.name || scope_id.slice(0, 8);
  }

  function scopeOptions(): Entity[] {
    switch (newAssignment.scope_type) {
      case 'tower':        return towers;
      case 'organization': return orgs;
      case 'company':      return companies;
      case 'location':     return locations;
      default:             return [];
    }
  }

  async function saveProfile() {
    setError('');
    try {
      await api.updateUser(id, profile);
      flash('Profile updated');
      setEditingProfile(false);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function toggleActive() {
    if (!user) return;
    try {
      await api.updateUser(id, { is_active: !user.is_active });
      flash(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function doReset() {
    setError('');
    try {
      const body = newPwd ? { password: newPwd } : {};
      const r = await api.resetPassword(id, body);
      setResetPwd(r.password);
      setNewPwd('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    if (newAssignment.scope_type !== 'global' && !newAssignment.scope_id) {
      setError(`Pick which ${newAssignment.scope_type} this role applies to`);
      return;
    }
    try {
      await api.assignRole(id, {
        role_id: newAssignment.role_id,
        scope_type: newAssignment.scope_type,
        scope_id: newAssignment.scope_type !== 'global' ? newAssignment.scope_id : null,
        expires_at: newAssignment.expires_at || null,
      });
      flash('Role assigned');
      setShowAddRole(false);
      setNewAssignment({ role_id: '', scope_type: 'global', scope_id: '', expires_at: '' });
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function removeRole(assignmentId: string, roleName: string) {
    const ok = await confirm({
      title: 'Remove role',
      message: `Remove role "${roleName}" from this user?`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.removeRole(id, assignmentId);
      flash('Role removed');
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function deleteUser() {
    const ok = await confirm({
      title: 'Delete user',
      message: `Permanently delete ${user?.name}? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await api.deleteUser(id);
      router.push('/dashboard/users');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading user...</div>;
  if (!user)   return <div className="p-8 text-red-600 text-sm">User not found</div>;

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <Link href="/dashboard/users" className="text-xs text-gray-500 hover:text-blue-600">
          ← Back to Users
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div className="flex items-start gap-4">
            {user.profile_image_url ? (
              <img
                src={profileImageSrc(user.profile_image_url) ?? ''}
                alt=""
                className="w-14 h-14 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-lg">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500">{user.email}</span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSelf ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                👤 This is your account
              </span>
            ) : (
              <>
                <button onClick={toggleActive}
                  className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={deleteUser}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Profile */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Profile</h2>
          {!editingProfile ? (
            <button onClick={() => setEditingProfile(true)}
              className="text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 px-2 py-1 rounded">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditingProfile(false); setProfile({ name: user.name, email: user.email, phone: user.phone || '' }); }}
                className="text-xs text-gray-500 hover:bg-gray-100 px-2 py-1 rounded">Cancel</button>
              <button onClick={saveProfile}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Save</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
            {editingProfile ? (
              <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            ) : <div className="text-sm text-gray-900">{user.name}</div>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            {editingProfile ? (
              <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            ) : <div className="text-sm text-gray-900">{user.email}</div>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
            {editingProfile ? (
              <input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            ) : <div className="text-sm text-gray-900">{user.phone || <span className="text-gray-400">—</span>}</div>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Joined</label>
            <div className="text-sm text-gray-900">{new Date(user.created_at).toLocaleString()}</div>
          </div>
        </div>
      </section>

      {/* Password */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Password</h2>
            <p className="text-xs text-gray-500 mt-1">Reset the user&apos;s password and share the new one with them.</p>
          </div>
          <button onClick={() => { setShowReset(true); setResetPwd(''); setNewPwd(''); }}
            className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">
            Reset Password
          </button>
        </div>

        {showReset && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            {resetPwd ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-green-900 mb-1">✓ Password reset successfully</div>
                <div className="text-xs text-green-800 mb-2">Share this new password with the user. <strong>It will not be shown again.</strong></div>
                <div className="bg-white border border-green-300 rounded px-3 py-2 font-mono text-sm flex items-center justify-between">
                  <span>{resetPwd}</span>
                  <button onClick={() => navigator.clipboard.writeText(resetPwd)}
                    className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded">Copy</button>
                </div>
                <button onClick={() => { setShowReset(false); setResetPwd(''); }}
                  className="mt-3 text-xs text-gray-600 hover:bg-gray-100 px-3 py-1 rounded">Done</button>
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">New password (leave blank to auto-generate)</label>
                  <input type="text" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    placeholder="Min 8 characters, or leave blank"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono" />
                </div>
                <button onClick={doReset}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">Reset</button>
                <button onClick={() => setShowReset(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Roles */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Role Assignments</h2>
            <p className="text-xs text-gray-500 mt-1">{assignments.length} active</p>
          </div>
          <button onClick={() => setShowAddRole(!showAddRole)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
            {showAddRole ? 'Cancel' : '+ Add Role'}
          </button>
        </div>

        {showAddRole && (
          <form onSubmit={addRole} className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
                <select
                  required
                  value={newAssignment.role_id}
                  onChange={e => setNewAssignment({ ...newAssignment, role_id: e.target.value })}
                  disabled={rolesLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value="">{rolesLoading ? 'Loading roles…' : '-- Select role --'}</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.display_name} (Level {r.level})</option>
                  ))}
                </select>
                {maxAssignableLevel != null && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Only roles at or below level {maxAssignableLevel}.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Scope Type</label>
                <select value={newAssignment.scope_type}
                  onChange={e => setNewAssignment({...newAssignment, scope_type: e.target.value as ScopeType, scope_id: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="global">Global</option>
                  <option value="tower">Tower</option>
                  <option value="organization">Organization</option>
                  <option value="company">Company</option>
                  <option value="location">Location</option>
                </select>
              </div>
              {newAssignment.scope_type !== 'global' && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Which {newAssignment.scope_type}? *
                  </label>
                  <select required value={newAssignment.scope_id}
                    onChange={e => setNewAssignment({...newAssignment, scope_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Select --</option>
                    {scopeOptions().map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Expires (optional · leave blank for permanent)
                </label>
                <input type="datetime-local" value={newAssignment.expires_at}
                  onChange={e => setNewAssignment({...newAssignment, expires_at: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-0.5">For temporary access (e.g. contractors)</p>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button type="submit" className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Assign Role
              </button>
            </div>
          </form>
        )}

        {assignments.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg">
            No roles assigned. This user has no permissions.
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => {
              const scope = scopeName(a.scope_type, a.scope_id);
              const expired = a.expires_at && new Date(a.expires_at) < new Date();
              return (
                <div key={a.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColor(a.level)}`}>
                      L{a.level}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{a.display_name}</div>
                      <div className="text-xs text-gray-500">
                        {a.scope_type === 'global' ? 'Global' : `${a.scope_type} · ${scope || '(unknown)'}`}
                        {a.expires_at && (
                          <span className={`ml-3 ${expired ? 'text-red-600' : 'text-amber-600'}`}>
                            {expired ? '⚠ Expired' : '⏱'} {new Date(a.expires_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeRole(a.id, a.display_name)}
                    className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded">
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <ConfirmDialog {...dialogProps} />
      <FlashToast message={error} variant="error" onDismiss={() => setError('')} />
      <FlashToast message={success} variant="success" onDismiss={() => setSuccess('')} />
    </div>
  );
}
