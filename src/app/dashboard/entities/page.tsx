'use client';
import { useState, useEffect, useCallback } from 'react';
import { api, mediaSrc } from '@/lib/api';
import {
  getTopScope, isSupport, getCreatableEntityTypes, getCreateEntityLabel,
  type CreatableEntityType,
} from '@/lib/auth';
import ApprovalChainEditor, { ApprovalChain } from '@/components/ApprovalChainEditor';
import EntityImageUploadButton from '@/components/EntityImageUploadButton';
import EmployeeCsvUploadButton from '@/components/EmployeeCsvUploadButton';
import EntityAvatar from '@/components/EntityAvatar';
import { useImageUploadProgress } from '@/hooks/useImageUploadProgress';

type Tower        = { id: string; name: string; address: string | null; image_url?: string | null; company_count: number; created_at: string };
type Company      = { id: string; tower_id: string; name: string; address: string | null; image_url?: string | null; created_at: string; approval_chain: ApprovalChain };
type Organization = { id: string; name: string; address: string | null; image_url?: string | null; location_count: number; created_at: string };
type Location     = { id: string; organization_id: string; name: string; address: string | null; image_url?: string | null; created_at: string; approval_chain: ApprovalChain };
type Tab          = 'towers' | 'organizations' | 'companies' | 'locations';
type EntityKind   = 'tower' | 'org' | 'company' | 'location';

type ManagerForm   = { name: string; email: string; autoPassword: boolean; password: string };
type ManagerResult = { name: string; email: string; password: string; entityName: string; roleDisplay: string };
type RoleDef       = { id: string; name: string; display_name: string; level: number; is_system: boolean };

// ── Credential card shown once after manager creation ───────────────────────
function CredentialCard({ result, onDone }: { result: ManagerResult; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(`Email: ${result.email}\nPassword: ${result.password}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="mt-2 bg-success-light border border-success-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-success">✓ Manager created for {result.entityName}</div>
          <div className="text-xs text-success mt-0.5">Share these credentials — password won&apos;t be shown again.</div>
        </div>
        <button onClick={onDone} className="text-success hover:text-success text-lg leading-none">✕</button>
      </div>
      <div className="bg-white border border-success-border rounded-lg p-3 font-mono text-sm space-y-1">
        <div><span className="text-gray-500 text-xs">Name&nbsp;&nbsp;&nbsp;:</span> {result.name}</div>
        <div><span className="text-gray-500 text-xs">Email&nbsp;&nbsp;:</span> {result.email}</div>
        <div><span className="text-gray-500 text-xs">Password:</span> <span className="font-bold text-success">{result.password}</span></div>
        <div><span className="text-gray-500 text-xs">Role&nbsp;&nbsp;&nbsp;:</span> <span className="text-primary">{result.roleDisplay}</span></div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={copy}
          className="text-xs px-3 py-1.5 border border-success-border text-success rounded-lg hover:bg-success-light">
          {copied ? '✓ Copied!' : '📋 Copy credentials'}
        </button>
        <button onClick={onDone}
          className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover">
          Done
        </button>
      </div>
    </div>
  );
}

// ── Inline "Add Manager" form ────────────────────────────────────────────────
const levelColor = (level: number) => {
  if (level >= 1000) return 'bg-primary text-white';
  if (level >= 400) return 'bg-primary-muted text-primary';
  return 'bg-gray-100 text-gray-600';
};

function ManagerForm({
  entityName, defaultRoleName, scopeType, scopeId,
  onSave, onCancel,
}: {
  entityName:      string;
  defaultRoleName: string;   // pre-selected role (entity's own role)
  scopeType:       'tower' | 'organization' | 'company' | 'location';
  scopeId:         string;
  onSave:          (result: ManagerResult) => void;
  onCancel:        () => void;
}) {
  const [form, setForm]               = useState<ManagerForm>({ name: '', email: '', autoPassword: true, password: '' });
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');
  const [roles, setRoles]             = useState<RoleDef[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleDef | null>(null);

  // Load assignable roles from API (self-level + entity ceiling enforced server-side)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.getAssignableRoles({ entityType: scopeType });
        const filtered = res.roles as RoleDef[];
        setRoles(filtered);
        const def = filtered.find(r => r.name === defaultRoleName) ?? filtered[0] ?? null;
        setSelectedRole(def);
      } catch { /* non-fatal */ }
      finally { setLoadingRoles(false); }
    })();
  }, [scopeType, defaultRoleName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!selectedRole) { setErr('Please select a role'); return; }
    if (!form.autoPassword && form.password.length < 8) {
      setErr('Password must be at least 8 characters'); return;
    }
    setSaving(true);
    try {
      const pwd = form.autoPassword
        ? `Vms-${Math.random().toString(36).slice(2, 8)}!`
        : form.password;

      await api.createUser({
        name: form.name, email: form.email, password: pwd,
        role_name: selectedRole.name, scope_type: scopeType, scope_id: scopeId,
      });
      onSave({ name: form.name, email: form.email, password: pwd, entityName, roleDisplay: selectedRole.display_name });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to create user');
    } finally { setSaving(false); }
  }

  return (
    <div className="mt-2 bg-primary-muted border border-primary-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-primary">Add User — {entityName}</div>
          <div className="text-xs text-primary mt-0.5">
            Creates a new account and assigns a role scoped to this {scopeType}
          </div>
        </div>
        <button onClick={onCancel} className="text-primary/70 hover:text-primary text-lg leading-none">✕</button>
      </div>

      {err && <div className="mb-3 text-xs text-danger bg-danger-light border border-danger-border px-3 py-2 rounded-lg">{err}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* Role selector — full width, top of form */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Role to assign *</label>
          {loadingRoles ? (
            <div className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-400 bg-white">Loading roles…</div>
          ) : roles.length === 0 ? (
            <div className="px-3 py-2 border border-danger-border rounded-lg text-xs text-danger bg-danger-light">No assignable roles found</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {roles.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                    selectedRole?.id === r.id
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-gray-200 bg-white hover:border-primary-border hover:bg-primary-muted text-gray-700'
                  }`}
                >
                  <div className="font-semibold leading-tight">{r.display_name}</div>
                  <div className={`mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-block ${
                    selectedRole?.id === r.id ? 'bg-primary text-white' : levelColor(r.level)
                  }`}>
                    Lv {r.level} {!r.is_system && '· custom'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name + Email */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Priya Sharma"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="priya@company.com"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white" />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <label className="text-xs font-medium text-gray-700">Password</label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.autoPassword}
                onChange={e => setForm({ ...form, autoPassword: e.target.checked, password: '' })}
                className="rounded" />
              <span className="text-xs text-gray-600">Auto-generate</span>
            </label>
          </div>
          {form.autoPassword ? (
            <div className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-500 italic">
              A secure password will be generated and shown once after creation.
            </div>
          ) : (
            <input type="password" required value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Min 8 characters"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white" />
          )}
        </div>

        {/* Summary bar */}
        {selectedRole && (
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-700">Will create:</span>
            <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${levelColor(selectedRole.level)}`}>
              {selectedRole.display_name}
            </span>
            <span className="text-gray-400">·</span>
            <span>Scoped to {scopeType} → <span className="font-medium text-gray-800">{entityName}</span></span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving || !selectedRole || loadingRoles}
            className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-60">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function EntitiesPage() {
  // Scope must be read client-side only (localStorage unavailable on SSR).
  // Initialize to "support = true" so SSR and first client render match,
  // then update after mount with the real values.
  const [userIsSupport, setUserIsSupport] = useState(true);
  const [scopeType, setScopeType]         = useState<string>('global');
  const { getProgress, onProgressChange } = useImageUploadProgress();
  useEffect(() => {
    const top = getTopScope();
    const support = isSupport();
    const st = top?.scope_type ?? 'global';
    setUserIsSupport(support);
    setScopeType(st);
    if (st === 'company') setTab('companies');
    else if (st === 'location') setTab('locations');
    else if (support || st === 'tower') setTab('towers');
    else setTab('organizations');
  }, []);

  // Hierarchy tabs: tower/org admins see parent entities + children.
  // Leaf-scope users see only their own entity type (no parent rows).
  const canSeeTowers    = userIsSupport || scopeType === 'tower';
  const canSeeOrgs      = userIsSupport || scopeType === 'organization';
  const canSeeCompanies = scopeType === 'company';
  const canSeeLocations = scopeType === 'location';

  // Fine-grained action permissions per scope level
  // Tower hierarchy
  const canEditTower         = userIsSupport || scopeType === 'tower';
  const canAddTowerManager   = userIsSupport || scopeType === 'tower';
  const canDeleteCompany     = userIsSupport || scopeType === 'tower';
  const canEditCompany       = userIsSupport || scopeType === 'tower' || scopeType === 'company';
  const canAddCompanyManager = userIsSupport || scopeType === 'tower' || scopeType === 'company';
  // Org hierarchy
  const canEditOrg            = userIsSupport || scopeType === 'organization';
  const canAddOrgManager      = userIsSupport || scopeType === 'organization';
  const canDeleteLocation     = userIsSupport || scopeType === 'organization';
  const canEditLocation       = userIsSupport || scopeType === 'organization' || scopeType === 'location';
  const canAddLocationManager = userIsSupport || scopeType === 'organization' || scopeType === 'location';

  const [tab, setTab] = useState<Tab>('towers');
  const [towers, setTowers]   = useState<Tower[]>([]);
  const [orgs, setOrgs]       = useState<Organization[]>([]);
  const [flatCompanies, setFlatCompanies] = useState<Company[]>([]);
  const [flatLocations, setFlatLocations] = useState<Location[]>([]);
  const [companies, setCompanies] = useState<Record<string, Company[]>>({});
  const [locations, setLocations] = useState<Record<string, Location[]>>({});
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  // Entity types this user may create — computed client-side only (localStorage unavailable on SSR).
  const [creatableEntityTypes, setCreatableEntityTypes] = useState<CreatableEntityType[]>([]);

  useEffect(() => {
    const expandedParentType =
      expanded && tab === 'towers' ? 'tower' as const
      : expanded && tab === 'organizations' ? 'organization' as const
      : null;
    setCreatableEntityTypes(getCreatableEntityTypes({
      hasExpandedParent: !!expanded,
      expandedParentType,
    }));
  }, [expanded, tab]);

  useEffect(() => {
    function refreshCreatable() {
      const expandedParentType =
        expanded && tab === 'towers' ? 'tower' as const
        : expanded && tab === 'organizations' ? 'organization' as const
        : null;
      setCreatableEntityTypes(getCreatableEntityTypes({
        hasExpandedParent: !!expanded,
        expandedParentType,
      }));
    }
    window.addEventListener('vms_permissions_updated', refreshCreatable);
    return () => window.removeEventListener('vms_permissions_updated', refreshCreatable);
  }, [expanded, tab]);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  // Approval chain editor
  const [chainEditorId, setChainEditorId]   = useState<string | null>(null);
  // Inline name/address edit
  const [editEntityId, setEditEntityId]     = useState<string | null>(null);
  const [editEntityForm, setEditEntityForm] = useState({ name: '', address: '' });
  // Add Manager
  const [managerForId, setManagerForId]     = useState<string | null>(null);
  const [managerResult, setManagerResult]   = useState<ManagerResult | null>(null);

  // Create-entity form (one active type at a time)
  const [activeCreateType, setActiveCreateType] = useState<CreatableEntityType | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', address: '' });

  const load = useCallback(async () => {
    try {
      const top = getTopScope();
      const support = isSupport();
      const st = top?.scope_type ?? 'global';
      const tasks: Promise<void>[] = [];

      if (support || st === 'tower') {
        tasks.push(api.getTowers().then(t => { setTowers(t.towers); }));
      }
      if (support || st === 'organization') {
        tasks.push(api.getOrganizations().then(o => { setOrgs(o.organizations); }));
      }
      if (st === 'company') {
        tasks.push(api.getCompanies().then(c => { setFlatCompanies(c.companies); }));
      }
      if (st === 'location') {
        tasks.push(api.getLocations().then(l => { setFlatLocations(l.locations); }));
      }

      await Promise.all(tasks);
    } catch { setError('Failed to load entities'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeCreateType && !creatableEntityTypes.includes(activeCreateType)) {
      setActiveCreateType(null);
    }
  }, [creatableEntityTypes, activeCreateType]);

  function toggleCreateForm(type: CreatableEntityType) {
    if (activeCreateType === type) {
      setActiveCreateType(null);
      setCreateForm({ name: '', address: '' });
    } else {
      setActiveCreateType(type);
      setCreateForm({ name: '', address: '' });
    }
  }

  async function toggleExpand(parentId: string, type: 'tower' | 'org') {
    if (expanded === parentId) {
      setExpanded(null);
      if (activeCreateType === 'company' || activeCreateType === 'location') {
        setActiveCreateType(null);
      }
      return;
    }
    setExpanded(parentId);
    try {
      if (type === 'tower' && !companies[parentId]) {
        const c = await api.getCompanies(parentId);
        setCompanies(prev => ({ ...prev, [parentId]: c.companies }));
      } else if (type === 'org' && !locations[parentId]) {
        const l = await api.getLocations(parentId);
        setLocations(prev => ({ ...prev, [parentId]: l.locations }));
      }
    } catch { setError('Failed to load children'); }
  }

  function flash(msg: string) {
    setSuccess(msg); setError('');
    setTimeout(() => setSuccess(''), 3000);
  }

  function openManager(id: string) {
    setManagerForId(id);
    setManagerResult(null);
    setChainEditorId(null);
    setEditEntityId(null);
  }

  function onManagerSaved(result: ManagerResult) {
    setManagerForId(null);
    setManagerResult(result);
    flash(`"${result.name}" created as ${result.roleDisplay} for ${result.entityName}`);
  }

  async function submitCreateEntity(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCreateType || !creatableEntityTypes.includes(activeCreateType)) return;

    try {
      const label = getCreateEntityLabel(activeCreateType).replace('Add ', '');
      if (activeCreateType === 'tower') {
        await api.createTower(createForm);
        flash(`${label} "${createForm.name}" created`);
      } else if (activeCreateType === 'organization') {
        await api.createOrganization(createForm);
        flash(`${label} "${createForm.name}" created`);
      } else if (activeCreateType === 'company') {
        const towerId = userIsSupport ? expanded : getTopScope()?.scope_id;
        if (!towerId) { setError('Expand a tower to add a company'); return; }
        await api.createCompany({ tower_id: towerId, ...createForm });
        const c = await api.getCompanies(towerId);
        setCompanies(prev => ({ ...prev, [towerId]: c.companies }));
        flash(`${label} "${createForm.name}" added`);
      } else if (activeCreateType === 'location') {
        const orgId = userIsSupport ? expanded : getTopScope()?.scope_id;
        if (!orgId) { setError('Expand an organization to add a location'); return; }
        await api.createLocation({ organization_id: orgId, ...createForm });
        const l = await api.getLocations(orgId);
        setLocations(prev => ({ ...prev, [orgId]: l.locations }));
        flash(`${label} "${createForm.name}" added`);
      }
      setCreateForm({ name: '', address: '' });
      setActiveCreateType(null);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  const createFormTitle: Record<CreatableEntityType, string> = {
    tower: 'New Tower',
    organization: 'New Organization',
    company: 'New Company',
    location: 'New Location',
  };

  async function deleteTower(id: string, name: string) {
    if (!confirm(`Delete tower "${name}" and all its companies?`)) return;
    try { await api.deleteTower(id); flash('Tower deleted'); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }
  async function deleteOrg(id: string, name: string) {
    if (!confirm(`Delete organization "${name}" and all its locations?`)) return;
    try { await api.deleteOrganization(id); flash('Organization deleted'); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }
  async function deleteCompany(id: string, name: string, towerId: string) {
    if (!confirm(`Delete company "${name}"?`)) return;
    try {
      await api.deleteCompany(id);
      const c = await api.getCompanies(towerId);
      setCompanies(prev => ({ ...prev, [towerId]: c.companies }));
      flash('Company deleted'); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }
  async function deleteLocation(id: string, name: string, orgId: string) {
    if (!confirm(`Delete location "${name}"?`)) return;
    try {
      await api.deleteLocation(id);
      const l = await api.getLocations(orgId);
      setLocations(prev => ({ ...prev, [orgId]: l.locations }));
      flash('Location deleted'); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  function openEditEntity(id: string, name: string, address: string | null) {
    setEditEntityId(id);
    setEditEntityForm({ name, address: address || '' });
    setChainEditorId(null); setManagerForId(null);
  }

  async function saveEntityEdit(kind: EntityKind, id: string, towerId?: string, orgId?: string) {
    try {
      if      (kind === 'tower')    await api.updateTower(id, editEntityForm);
      else if (kind === 'org')      await api.updateOrganization(id, editEntityForm);
      else if (kind === 'company')  await api.updateCompany(id, editEntityForm);
      else if (kind === 'location') await api.updateLocation(id, editEntityForm);
      flash('Saved'); setEditEntityId(null);
      if (kind === 'tower' || kind === 'org') { load(); }
      else if (kind === 'company' && towerId) {
        const c = await api.getCompanies(towerId);
        setCompanies(prev => ({ ...prev, [towerId]: c.companies })); load();
      } else if (kind === 'company') {
        const c = await api.getCompanies();
        setFlatCompanies(c.companies); load();
      } else if (kind === 'location' && orgId) {
        const l = await api.getLocations(orgId);
        setLocations(prev => ({ ...prev, [orgId]: l.locations })); load();
      } else if (kind === 'location') {
        const l = await api.getLocations();
        setFlatLocations(l.locations); load();
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to save'); }
  }

  async function saveCompanyChain(companyId: string, chain: ApprovalChain) {
    await api.updateCompany(companyId, { approval_chain: chain });
    const parentTowerId = Object.keys(companies).find(tid => companies[tid].some(c => c.id === companyId));
    if (parentTowerId) {
      const c = await api.getCompanies(parentTowerId);
      setCompanies(prev => ({ ...prev, [parentTowerId]: c.companies }));
    } else if (scopeType === 'company') {
      const c = await api.getCompanies();
      setFlatCompanies(c.companies);
    }
    flash('Approval chain saved'); setChainEditorId(null);
  }

  async function saveLocationChain(locationId: string, chain: ApprovalChain) {
    await api.updateLocation(locationId, { approval_chain: chain });
    const parentOrgId = Object.keys(locations).find(oid => locations[oid].some(l => l.id === locationId));
    if (parentOrgId) {
      const l = await api.getLocations(parentOrgId);
      setLocations(prev => ({ ...prev, [parentOrgId]: l.locations }));
    } else if (scopeType === 'location') {
      const l = await api.getLocations();
      setFlatLocations(l.locations);
    }
    flash('Approval chain saved'); setChainEditorId(null);
  }

  // ── Shared action button strip for Tower/Org rows ──────────────────────────
  function updateEntityImage(
    kind: 'tower' | 'org' | 'company' | 'location',
    entityId: string,
    url: string,
    parentId?: string,
  ) {
    if (kind === 'tower') {
      setTowers(prev => prev.map(t => t.id === entityId ? { ...t, image_url: url } : t));
    } else if (kind === 'org') {
      setOrgs(prev => prev.map(o => o.id === entityId ? { ...o, image_url: url } : o));
    } else if (kind === 'company' && parentId) {
      setCompanies(prev => ({
        ...prev,
        [parentId]: (prev[parentId] || []).map(c => c.id === entityId ? { ...c, image_url: url } : c),
      }));
    } else if (kind === 'company') {
      setFlatCompanies(prev => prev.map(c => c.id === entityId ? { ...c, image_url: url } : c));
    } else if (kind === 'location' && parentId) {
      setLocations(prev => ({
        ...prev,
        [parentId]: (prev[parentId] || []).map(l => l.id === entityId ? { ...l, image_url: url } : l),
      }));
    } else if (kind === 'location') {
      setFlatLocations(prev => prev.map(l => l.id === entityId ? { ...l, image_url: url } : l));
    }
    flash('Image uploaded');
  }

  function ParentActions({
    id, name, address, kind, onImageUploaded, onProgressChange: onUploadProgress,
  }: {
    id: string; name: string; address: string | null; kind: 'tower' | 'org';
    onImageUploaded: (url?: string) => void;
    onProgressChange?: (progress: number | null) => void;
  }) {
    const canEdit      = kind === 'tower' ? canEditTower      : canEditOrg;
    const canAddMgr    = kind === 'tower' ? canAddTowerManager : canAddOrgManager;
    const canDelete    = userIsSupport;

    return (
      <div className="flex gap-1 flex-wrap justify-end">
        <EntityImageUploadButton
          entityType={kind === 'tower' ? 'tower' : 'organization'}
          entityId={id}
          onUploaded={onImageUploaded}
          onProgressChange={onUploadProgress}
        />
        <EmployeeCsvUploadButton
          mode="child"
          entityType={kind === 'tower' ? 'tower' : 'organization'}
          entityId={id}
          onImported={() => flash('Employee CSV import finished')}
        />
        {canEdit && (
          <button onClick={() => openEditEntity(id, name, address)}
            className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">Edit</button>
        )}
        {canAddMgr && (
          <button onClick={() => managerForId === id ? setManagerForId(null) : openManager(id)}
            className={`text-xs border px-2 py-1 rounded ${managerForId === id ? 'bg-success-light text-success border-success-border' : 'text-success hover:bg-success-light border-success-border'}`}>
            👤 {managerForId === id ? 'Cancel' : 'Add User'}
          </button>
        )}
        {canDelete && (
          <button onClick={() => kind === 'tower' ? deleteTower(id, name) : deleteOrg(id, name)}
            className="text-xs text-danger hover:bg-danger-light px-2 py-1 rounded">Delete</button>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Entities</h1>
          <p className="text-sm text-gray-500">
            {canSeeCompanies ? 'Your company'
              : canSeeLocations ? 'Your location'
              : 'Towers contain Companies · Organizations contain Locations'}
          </p>
        </div>
        {creatableEntityTypes.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {creatableEntityTypes.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => toggleCreateForm(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCreateType === type
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                {activeCreateType === type ? 'Cancel' : `+ ${getCreateEntityLabel(type)}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeCreateType && creatableEntityTypes.includes(activeCreateType) && (
        <form onSubmit={submitCreateEntity} className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{createFormTitle[activeCreateType]}</h3>
          {(activeCreateType === 'company' && userIsSupport && !expanded) && (
            <p className="text-xs text-warning bg-warning-light border border-warning-border rounded-lg px-3 py-2 mb-3">
              Expand a tower first, then add a company under it.
            </p>
          )}
          {(activeCreateType === 'location' && userIsSupport && !expanded) && (
            <p className="text-xs text-warning bg-warning-light border border-warning-border rounded-lg px-3 py-2 mb-3">
              Expand an organization first, then add a location under it.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder={`${createFormTitle[activeCreateType].replace('New ', '')} name *`}
              value={createForm.name}
              onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
            />
            <input
              placeholder="Address"
              value={createForm.address}
              onChange={e => setCreateForm({ ...createForm, address: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              disabled={
                (activeCreateType === 'company' && userIsSupport && !expanded)
                || (activeCreateType === 'location' && userIsSupport && !expanded)
              }
              className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Tabs — only show tabs the user has access to */}
      <div className="flex gap-1 mb-6 bg-white p-1 rounded-xl border border-gray-200 w-fit">
        {canSeeTowers && (
          <button onClick={() => setTab('towers')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'towers' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            Towers ({towers.length})
          </button>
        )}
        {canSeeOrgs && (
          <button onClick={() => setTab('organizations')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'organizations' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            Organizations ({orgs.length})
          </button>
        )}
        {canSeeCompanies && (
          <button onClick={() => setTab('companies')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'companies' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            Companies ({flatCompanies.length})
          </button>
        )}
        {canSeeLocations && (
          <button onClick={() => setTab('locations')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'locations' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            Locations ({flatLocations.length})
          </button>
        )}
      </div>

      {error   && <div className="mb-4 bg-danger-light border border-danger-border text-danger text-sm px-4 py-2 rounded-lg">{error}</div>}
      {success && <div className="mb-4 bg-success-light border border-success-border text-success text-sm px-4 py-2 rounded-lg">{success}</div>}

      {/* Global credential result card */}
      {managerResult && (
        <CredentialCard result={managerResult} onDone={() => setManagerResult(null)} />
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>

      ) : tab === 'companies' ? (
        /* ══════════════════ COMPANIES (company-scoped flat view) ══════════════════ */
        <div>
          {flatCompanies.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center text-gray-400 text-sm">
              No company assigned to your account.
            </div>
          ) : (
            <div className="space-y-3">
              {flatCompanies.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {editEntityId === c.id ? (
                    <div className="px-5 py-3 bg-primary-muted">
                      <div className="flex items-center gap-2">
                        <input value={editEntityForm.name} onChange={e => setEditEntityForm({ ...editEntityForm, name: e.target.value })}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white font-semibold" />
                        <input value={editEntityForm.address} onChange={e => setEditEntityForm({ ...editEntityForm, address: e.target.value })}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white" placeholder="Address" />
                        <button onClick={() => saveEntityEdit('company', c.id)}
                          className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary-hover">Save</button>
                        <button onClick={() => setEditEntityId(null)}
                          className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <EntityAvatar name={c.name} imageUrl={c.image_url} uploadProgress={getProgress(c.id)} />
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">{c.name}</div>
                          {c.address && <div className="text-xs text-gray-500 mt-0.5">{c.address}</div>}
                          <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full ${c.approval_chain?.bypass_enabled ? 'bg-warning-light text-warning' : 'bg-gray-100 text-gray-500'}`}>
                              Bypass {c.approval_chain?.bypass_enabled ? 'ON' : 'OFF'}
                            </span>
                            <span className="text-gray-500">{c.approval_chain?.steps?.length || 0} step(s)</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                        <EntityImageUploadButton entityType="company" entityId={c.id}
                          onUploaded={(url) => url && updateEntityImage('company', c.id, url)}
                          onProgressChange={onProgressChange(c.id)} />
                        <EmployeeCsvUploadButton mode="child" entityType="company" entityId={c.id}
                          onImported={() => flash('Employee CSV import finished')} />
                        {canEditCompany && (
                          <button onClick={() => openEditEntity(c.id, c.name, c.address)}
                            className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">Edit</button>
                        )}
                        {canAddCompanyManager && (
                          <button onClick={() => managerForId === c.id ? setManagerForId(null) : openManager(c.id)}
                            className={`text-xs border px-2 py-1 rounded ${managerForId === c.id ? 'bg-success-light text-success border-success-border' : 'text-success hover:bg-success-light border-success-border'}`}>
                            👤 {managerForId === c.id ? 'Cancel' : 'Add User'}
                          </button>
                        )}
                        {canEditCompany && (
                          <button onClick={() => setChainEditorId(chainEditorId === c.id ? null : c.id)}
                            className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">
                            {chainEditorId === c.id ? 'Close' : '⚙ Chain'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {managerForId === c.id && (
                    <div className="px-5 pb-4">
                      <ManagerForm entityName={c.name} defaultRoleName="company"
                        scopeType="company" scopeId={c.id}
                        onSave={onManagerSaved} onCancel={() => setManagerForId(null)} />
                    </div>
                  )}
                  {chainEditorId === c.id && (
                    <div className="px-5 pb-4">
                      <ApprovalChainEditor entityName={c.name}
                        initial={c.approval_chain || { bypass_enabled: false, steps: [] }}
                        onSave={(chain) => saveCompanyChain(c.id, chain)}
                        onCancel={() => setChainEditorId(null)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      ) : tab === 'locations' ? (
        /* ══════════════════ LOCATIONS (location-scoped flat view) ══════════════════ */
        <div>
          {flatLocations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center text-gray-400 text-sm">
              No location assigned to your account.
            </div>
          ) : (
            <div className="space-y-3">
              {flatLocations.map(l => (
                <div key={l.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {editEntityId === l.id ? (
                    <div className="px-5 py-3 bg-primary-muted">
                      <div className="flex items-center gap-2">
                        <input value={editEntityForm.name} onChange={e => setEditEntityForm({ ...editEntityForm, name: e.target.value })}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white font-semibold" />
                        <input value={editEntityForm.address} onChange={e => setEditEntityForm({ ...editEntityForm, address: e.target.value })}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white" placeholder="Address" />
                        <button onClick={() => saveEntityEdit('location', l.id)}
                          className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary-hover">Save</button>
                        <button onClick={() => setEditEntityId(null)}
                          className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <EntityAvatar name={l.name} imageUrl={l.image_url} uploadProgress={getProgress(l.id)} />
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">{l.name}</div>
                          {l.address && <div className="text-xs text-gray-500 mt-0.5">{l.address}</div>}
                          <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full ${l.approval_chain?.bypass_enabled ? 'bg-warning-light text-warning' : 'bg-gray-100 text-gray-500'}`}>
                              Bypass {l.approval_chain?.bypass_enabled ? 'ON' : 'OFF'}
                            </span>
                            <span className="text-gray-500">{l.approval_chain?.steps?.length || 0} step(s)</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                        <EntityImageUploadButton entityType="location" entityId={l.id}
                          onUploaded={(url) => url && updateEntityImage('location', l.id, url)}
                          onProgressChange={onProgressChange(l.id)} />
                        <EmployeeCsvUploadButton mode="child" entityType="location" entityId={l.id}
                          onImported={() => flash('Employee CSV import finished')} />
                        {canEditLocation && (
                          <button onClick={() => openEditEntity(l.id, l.name, l.address)}
                            className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">Edit</button>
                        )}
                        {canAddLocationManager && (
                          <button onClick={() => managerForId === l.id ? setManagerForId(null) : openManager(l.id)}
                            className={`text-xs border px-2 py-1 rounded ${managerForId === l.id ? 'bg-success-light text-success border-success-border' : 'text-success hover:bg-success-light border-success-border'}`}>
                            👤 {managerForId === l.id ? 'Cancel' : 'Add User'}
                          </button>
                        )}
                        {canEditLocation && (
                          <button onClick={() => setChainEditorId(chainEditorId === l.id ? null : l.id)}
                            className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">
                            {chainEditorId === l.id ? 'Close' : '⚙ Chain'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {managerForId === l.id && (
                    <div className="px-5 pb-4">
                      <ManagerForm entityName={l.name} defaultRoleName="location"
                        scopeType="location" scopeId={l.id}
                        onSave={onManagerSaved} onCancel={() => setManagerForId(null)} />
                    </div>
                  )}
                  {chainEditorId === l.id && (
                    <div className="px-5 pb-4">
                      <ApprovalChainEditor entityName={l.name}
                        initial={l.approval_chain || { bypass_enabled: false, steps: [] }}
                        onSave={(chain) => saveLocationChain(l.id, chain)}
                        onCancel={() => setChainEditorId(null)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      ) : tab === 'towers' ? (
        /* ══════════════════ TOWERS TAB ══════════════════ */
        <div>
          {towers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center text-gray-400 text-sm">
              No towers yet. Add the first one.
            </div>
          ) : (
            <div className="space-y-3">
              {towers.map(t => {
                const isOpen = expanded === t.id;
                const list   = companies[t.id] || [];
                return (
                  <div key={t.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

                    {/* Tower row */}
                    {editEntityId === t.id ? (
                      <div className="px-5 py-3 bg-primary-muted border-b border-primary-border">
                        <div className="flex items-center gap-2">
                          <input value={editEntityForm.name} onChange={e => setEditEntityForm({ ...editEntityForm, name: e.target.value })}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white font-semibold" placeholder="Tower name" />
                          <input value={editEntityForm.address} onChange={e => setEditEntityForm({ ...editEntityForm, address: e.target.value })}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white" placeholder="Address" />
                          <button onClick={() => saveEntityEdit('tower', t.id)}
                            className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary-hover">Save</button>
                          <button onClick={() => setEditEntityId(null)}
                            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-5 py-4 gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(t.id, 'tower')}>
                          <EntityAvatar name={t.name} imageUrl={t.image_url} uploadProgress={getProgress(t.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-400">{isOpen ? '▾' : '▸'}</span>
                              <div className="font-semibold text-gray-900">{t.name}</div>
                              <span className="text-xs bg-primary-muted text-primary px-2 py-0.5 rounded-full">
                                {t.company_count} {t.company_count === 1 ? 'company' : 'companies'}
                              </span>
                            </div>
                            {t.address && <div className="text-xs text-gray-500 mt-0.5">{t.address}</div>}
                          </div>
                        </div>
                        <ParentActions
                          id={t.id} name={t.name} address={t.address} kind="tower"
                          onImageUploaded={(url) => url && updateEntityImage('tower', t.id, url)}
                          onProgressChange={onProgressChange(t.id)}
                        />
                      </div>
                    )}

                    {/* Tower-level manager form */}
                    {managerForId === t.id && (
                      <div className="px-5 pb-4">
                        <ManagerForm
                          entityName={t.name} defaultRoleName="tower"
                          scopeType="tower" scopeId={t.id}
                          onSave={onManagerSaved}
                          onCancel={() => setManagerForId(null)}
                        />
                      </div>
                    )}

                    {/* Expanded companies */}
                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Companies</div>
                        </div>

                        {list.length === 0 ? (
                          <div className="text-xs text-gray-400 italic px-2 py-2">No companies yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {list.map(c => (
                              <div key={c.id}>
                                {editEntityId === c.id ? (
                                  <div className="bg-primary-muted rounded-lg border border-primary-border px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <input value={editEntityForm.name} onChange={e => setEditEntityForm({ ...editEntityForm, name: e.target.value })}
                                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white font-medium" />
                                      <input value={editEntityForm.address} onChange={e => setEditEntityForm({ ...editEntityForm, address: e.target.value })}
                                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white" placeholder="Address" />
                                      <button onClick={() => saveEntityEdit('company', c.id, t.id)}
                                        className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary-hover">Save</button>
                                      <button onClick={() => setEditEntityId(null)}
                                        className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <EntityAvatar name={c.name} imageUrl={c.image_url} size="sm" uploadProgress={getProgress(c.id)} />
                                      <div className="min-w-0">
                                        <div className="font-medium text-sm text-gray-900">{c.name}</div>
                                        {c.address && <div className="text-xs text-gray-500">{c.address}</div>}
                                        <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                                          <span className={`px-2 py-0.5 rounded-full ${c.approval_chain?.bypass_enabled ? 'bg-warning-light text-warning' : 'bg-gray-100 text-gray-500'}`}>
                                            Bypass {c.approval_chain?.bypass_enabled ? 'ON' : 'OFF'}
                                          </span>
                                          <span className="text-gray-500">{c.approval_chain?.steps?.length || 0} step(s)</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                                      <EntityImageUploadButton
                                        entityType="company"
                                        entityId={c.id}
                                        onUploaded={(url) => url && updateEntityImage('company', c.id, url, t.id)}
                                        onProgressChange={onProgressChange(c.id)}
                                      />
                                      <EmployeeCsvUploadButton
                                        mode="child"
                                        entityType="company"
                                        entityId={c.id}
                                        onImported={() => flash('Employee CSV import finished')}
                                      />
                                      {canEditCompany && (
                                        <button onClick={() => openEditEntity(c.id, c.name, c.address)}
                                          className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">Edit</button>
                                      )}
                                      {canAddCompanyManager && (
                                        <button onClick={() => managerForId === c.id ? setManagerForId(null) : openManager(c.id)}
                                          className={`text-xs border px-2 py-1 rounded ${managerForId === c.id ? 'bg-success-light text-success border-success-border' : 'text-success hover:bg-success-light border-success-border'}`}>
                                          👤 {managerForId === c.id ? 'Cancel' : 'Add User'}
                                        </button>
                                      )}
                                      {canEditCompany && (
                                        <button onClick={() => setChainEditorId(chainEditorId === c.id ? null : c.id)}
                                          className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">
                                          {chainEditorId === c.id ? 'Close' : '⚙ Chain'}
                                        </button>
                                      )}
                                      {canDeleteCompany && (
                                        <button onClick={() => deleteCompany(c.id, c.name, t.id)}
                                          className="text-xs text-danger hover:bg-danger-light px-2 py-1 rounded">Delete</button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Company manager form */}
                                {managerForId === c.id && (
                                  <ManagerForm
                                    entityName={c.name} defaultRoleName="company"
                                    scopeType="company" scopeId={c.id}
                                    onSave={onManagerSaved}
                                    onCancel={() => setManagerForId(null)}
                                  />
                                )}

                                {/* Approval chain editor */}
                                {chainEditorId === c.id && (
                                  <div className="mt-2 mb-1">
                                    <ApprovalChainEditor
                                      entityName={c.name}
                                      initial={c.approval_chain || { bypass_enabled: false, steps: [] }}
                                      onSave={(chain) => saveCompanyChain(c.id, chain)}
                                      onCancel={() => setChainEditorId(null)}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      ) : (
        /* ══════════════════ ORGANIZATIONS TAB ══════════════════ */
        <div>
          {orgs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center text-gray-400 text-sm">
              No organizations yet. Add the first one.
            </div>
          ) : (
            <div className="space-y-3">
              {orgs.map(o => {
                const isOpen = expanded === o.id;
                const list   = locations[o.id] || [];
                return (
                  <div key={o.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

                    {/* Org row */}
                    {editEntityId === o.id ? (
                      <div className="px-5 py-3 bg-primary-muted border-b border-primary-border">
                        <div className="flex items-center gap-2">
                          <input value={editEntityForm.name} onChange={e => setEditEntityForm({ ...editEntityForm, name: e.target.value })}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white font-semibold" placeholder="Organization name" />
                          <input value={editEntityForm.address} onChange={e => setEditEntityForm({ ...editEntityForm, address: e.target.value })}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white" placeholder="Address" />
                          <button onClick={() => saveEntityEdit('org', o.id)}
                            className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary-hover">Save</button>
                          <button onClick={() => setEditEntityId(null)}
                            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-5 py-4 gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(o.id, 'org')}>
                          <EntityAvatar name={o.name} imageUrl={o.image_url} uploadProgress={getProgress(o.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-400">{isOpen ? '▾' : '▸'}</span>
                              <div className="font-semibold text-gray-900">{o.name}</div>
                              <span className="text-xs bg-primary-muted text-primary px-2 py-0.5 rounded-full">
                                {o.location_count} {o.location_count === 1 ? 'location' : 'locations'}
                              </span>
                            </div>
                            {o.address && <div className="text-xs text-gray-500 mt-0.5">{o.address}</div>}
                          </div>
                        </div>
                        <ParentActions
                          id={o.id} name={o.name} address={o.address} kind="org"
                          onImageUploaded={(url) => url && updateEntityImage('org', o.id, url)}
                          onProgressChange={onProgressChange(o.id)}
                        />
                      </div>
                    )}

                    {/* Org-level manager form */}
                    {managerForId === o.id && (
                      <div className="px-5 pb-4">
                        <ManagerForm
                          entityName={o.name} defaultRoleName="organization"
                          scopeType="organization" scopeId={o.id}
                          onSave={onManagerSaved}
                          onCancel={() => setManagerForId(null)}
                        />
                      </div>
                    )}

                    {/* Expanded locations */}
                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Locations</div>
                        </div>

                        {list.length === 0 ? (
                          <div className="text-xs text-gray-400 italic px-2 py-2">No locations yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {list.map(l => (
                              <div key={l.id}>
                                {editEntityId === l.id ? (
                                  <div className="bg-primary-muted rounded-lg border border-primary-border px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <input value={editEntityForm.name} onChange={e => setEditEntityForm({ ...editEntityForm, name: e.target.value })}
                                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white font-medium" />
                                      <input value={editEntityForm.address} onChange={e => setEditEntityForm({ ...editEntityForm, address: e.target.value })}
                                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white" placeholder="Address" />
                                      <button onClick={() => saveEntityEdit('location', l.id, undefined, o.id)}
                                        className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary-hover">Save</button>
                                      <button onClick={() => setEditEntityId(null)}
                                        className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-lg border border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <EntityAvatar name={l.name} imageUrl={l.image_url} size="sm" uploadProgress={getProgress(l.id)} />
                                      <div className="min-w-0">
                                        <div className="font-medium text-sm text-gray-900">{l.name}</div>
                                        {l.address && <div className="text-xs text-gray-500">{l.address}</div>}
                                        <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                                          <span className={`px-2 py-0.5 rounded-full ${l.approval_chain?.bypass_enabled ? 'bg-warning-light text-warning' : 'bg-gray-100 text-gray-500'}`}>
                                            Bypass {l.approval_chain?.bypass_enabled ? 'ON' : 'OFF'}
                                          </span>
                                          <span className="text-gray-500">{l.approval_chain?.steps?.length || 0} step(s)</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                                      <EntityImageUploadButton
                                        entityType="location"
                                        entityId={l.id}
                                        onUploaded={(url) => url && updateEntityImage('location', l.id, url, o.id)}
                                        onProgressChange={onProgressChange(l.id)}
                                      />
                                      <EmployeeCsvUploadButton
                                        mode="child"
                                        entityType="location"
                                        entityId={l.id}
                                        onImported={() => flash('Employee CSV import finished')}
                                      />
                                      {canEditLocation && (
                                        <button onClick={() => openEditEntity(l.id, l.name, l.address)}
                                          className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">Edit</button>
                                      )}
                                      {canAddLocationManager && (
                                        <button onClick={() => managerForId === l.id ? setManagerForId(null) : openManager(l.id)}
                                          className={`text-xs border px-2 py-1 rounded ${managerForId === l.id ? 'bg-success-light text-success border-success-border' : 'text-success hover:bg-success-light border-success-border'}`}>
                                          👤 {managerForId === l.id ? 'Cancel' : 'Add User'}
                                        </button>
                                      )}
                                      {canEditLocation && (
                                        <button onClick={() => setChainEditorId(chainEditorId === l.id ? null : l.id)}
                                          className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-2 py-1 rounded">
                                          {chainEditorId === l.id ? 'Close' : '⚙ Chain'}
                                        </button>
                                      )}
                                      {canDeleteLocation && (
                                        <button onClick={() => deleteLocation(l.id, l.name, o.id)}
                                          className="text-xs text-danger hover:bg-danger-light px-2 py-1 rounded">Delete</button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Location manager form */}
                                {managerForId === l.id && (
                                  <ManagerForm
                                    entityName={l.name} defaultRoleName="location"
                                    scopeType="location" scopeId={l.id}
                                    onSave={onManagerSaved}
                                    onCancel={() => setManagerForId(null)}
                                  />
                                )}

                                {/* Approval chain editor */}
                                {chainEditorId === l.id && (
                                  <div className="mt-2 mb-1">
                                    <ApprovalChainEditor
                                      entityName={l.name}
                                      initial={l.approval_chain || { bypass_enabled: false, steps: [] }}
                                      onSave={(chain) => saveLocationChain(l.id, chain)}
                                      onCancel={() => setChainEditorId(null)}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
