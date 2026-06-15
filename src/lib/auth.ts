'use client';

type Assignment = { scope_type: string; scope_id: string | null; level: number; role_name: string; display_name: string };

function notifyPermissionsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('vms_permissions_updated'));
  }
}

export function saveAuth(token: string, user: object, permissions: string[], assignments: Assignment[] = []) {
  localStorage.setItem('vms_token', token);
  localStorage.setItem('vms_user', JSON.stringify(user));
  localStorage.setItem('vms_permissions', JSON.stringify(permissions));
  localStorage.setItem('vms_assignments', JSON.stringify(assignments));
  notifyPermissionsChanged();
}

export function clearAuth() {
  localStorage.removeItem('vms_token');
  localStorage.removeItem('vms_user');
  localStorage.removeItem('vms_permissions');
  localStorage.removeItem('vms_assignments');
  localStorage.removeItem('vms_profile_image_url');
  localStorage.removeItem('vms_profile_image_v');
}

const PROFILE_IMAGE_URL_KEY = 'vms_profile_image_url';
const PROFILE_IMAGE_V_KEY = 'vms_profile_image_v';

export function getStoredProfileImage(): { url: string | null; version: number } {
  if (typeof window === 'undefined') return { url: null, version: 0 };
  return {
    url: localStorage.getItem(PROFILE_IMAGE_URL_KEY),
    version: parseInt(localStorage.getItem(PROFILE_IMAGE_V_KEY) || '0', 10),
  };
}

/** Persist profile image URL and notify all listeners (header, dashboard, etc.). */
export function setStoredProfileImage(url: string): number {
  const version = Date.now();
  localStorage.setItem(PROFILE_IMAGE_URL_KEY, url);
  localStorage.setItem(PROFILE_IMAGE_V_KEY, String(version));
  window.dispatchEvent(new CustomEvent('vms_profile_image_updated', { detail: { url, version } }));
  return version;
}

export function getUser(): { id: string; email: string; name: string; phone?: string } | null {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('vms_user');
  return u ? JSON.parse(u) : null;
}

export function getPermissions(): string[] {
  if (typeof window === 'undefined') return [];
  const p = localStorage.getItem('vms_permissions');
  return p ? JSON.parse(p) : [];
}

export function getAssignments(): Assignment[] {
  if (typeof window === 'undefined') return [];
  const a = localStorage.getItem('vms_assignments');
  return a ? JSON.parse(a) : [];
}

/** Returns the user's highest-level active role assignment. */
export function getTopScope(): Assignment | null {
  const assignments = getAssignments();
  if (!assignments.length) return null;
  return assignments.slice().sort((a, b) => b.level - a.level)[0];
}

/** True when the user has unrestricted (Support / global) access. */
export function isSupport(): boolean {
  const top = getTopScope();
  return !top || top.level >= 1000 || top.scope_type === 'global';
}

export function can(action: string) {
  return getPermissions().includes(action);
}

export type ScopedEntityType = 'tower' | 'company' | 'organization' | 'location';

/** The entity tied to the user's top role assignment (null for support/global). */
export function getScopedEntity(): { type: ScopedEntityType; id: string } | null {
  const top = getTopScope();
  if (!top?.scope_id || isSupport()) return null;
  const t = top.scope_type;
  if (t === 'tower' || t === 'company' || t === 'organization' || t === 'location') {
    return { type: t, id: top.scope_id };
  }
  return null;
}

const SCOPED_ENTITY_LABELS: Record<ScopedEntityType, string> = {
  tower: 'Tower',
  company: 'Company',
  organization: 'Organization',
  location: 'Location',
};

export function getScopedEntityLabel(type: ScopedEntityType): string {
  return SCOPED_ENTITY_LABELS[type];
}

/**
 * Entity types visible in Employees filters/forms for the logged-in user.
 * - Support: all types (both hierarchies).
 * - Tower: tower + child companies.
 * - Organization: organization + child locations.
 * - Company / location: own type only.
 */
export function getVisibleEmployeeEntityTypes(): ScopedEntityType[] {
  if (isSupport()) {
    return ['tower', 'organization', 'company', 'location'];
  }

  const top = getTopScope();
  const st = top?.scope_type;

  if (st === 'tower') return ['tower', 'company'];
  if (st === 'organization') return ['organization', 'location'];
  if (st === 'company') return ['company'];
  if (st === 'location') return ['location'];

  return ['tower', 'organization', 'company', 'location'];
}

/** Dashboard / profile — logged-in user's own image */
export function canUploadSelfImage(): boolean {
  return can('image:upload_self');
}

/** Entities list — child entity images (companies, locations, etc.) */
export function canUploadChildEntityImage(): boolean {
  return can('image:upload_child');
}

/** Dashboard — import employees for the user's own scoped entity */
export function canUploadSelfEmployeeCsv(): boolean {
  return can('employee:csv_upload_self');
}

/** Entities list — import employees for child/subordinate entities */
export function canUploadChildEmployeeCsv(): boolean {
  return can('employee:csv_upload_child');
}

export function canReadEmployees(): boolean {
  return can('employee:read');
}

export function canCreateEmployee(): boolean {
  return can('employee:create');
}

export function canUpdateEmployee(): boolean {
  return can('employee:update');
}

export function canDeleteEmployee(): boolean {
  return can('employee:delete');
}

export function setPermissions(permissions: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('vms_permissions', JSON.stringify(permissions));
  notifyPermissionsChanged();
}

export function isLoggedIn() {
  return !!localStorage.getItem('vms_token');
}

/** Entity types that may be created as direct children of the user's scope. */
export type CreatableEntityType = 'tower' | 'organization' | 'company' | 'location';

const CREATE_LABELS: Record<CreatableEntityType, string> = {
  tower: 'Add Tower',
  organization: 'Add Organization',
  company: 'Add Company',
  location: 'Add Location',
};

export function getCreateEntityLabel(type: CreatableEntityType): string {
  return CREATE_LABELS[type];
}

/**
 * Entity types the logged-in user may create, based on role permissions and hierarchy.
 * - Support: tower, organization; company/location only when a parent row is expanded.
 * - Tower scope: company (under their tower).
 * - Organization scope: location (under their org).
 * - Company / location scope: none (leaf nodes; no entity:create).
 */
export function getCreatableEntityTypes(options?: {
  expandedParentType?: 'tower' | 'organization' | null;
  hasExpandedParent?: boolean;
}): CreatableEntityType[] {
  if (!can('entity:create')) return [];

  const top = getTopScope();
  const support = isSupport();

  if (support) {
    const types: CreatableEntityType[] = ['tower', 'organization'];
    if (options?.hasExpandedParent && options.expandedParentType === 'tower') {
      types.push('company');
    }
    if (options?.hasExpandedParent && options.expandedParentType === 'organization') {
      types.push('location');
    }
    return types;
  }

  if (top?.scope_type === 'tower') return ['company'];
  if (top?.scope_type === 'organization') return ['location'];
  return [];
}
