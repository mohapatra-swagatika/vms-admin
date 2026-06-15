const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Keep in sync with backend UPLOAD_MAX_IMAGE_MB (default 10). */
export const MAX_IMAGE_UPLOAD_MB = parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_IMAGE_MB || '10', 10);
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
export const MAX_ENTITY_IMAGES_PER_UPLOAD = parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_FILES || '10', 10);

export {
  EMPLOYEE_CSV_REQUIRED_HEADERS,
  EMPLOYEE_CSV_OPTIONAL_HEADERS,
  EMPLOYEE_CSV_KNOWN_HEADERS,
  validateEmployeeCsvHeaders,
} from '@/lib/employeeCsv';

export type Employee = {
  id: string;
  entity_type: 'tower' | 'company' | 'organization' | 'location';
  entity_id: string;
  entity_name?: string;
  employee_code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmployeeListParams = {
  entity_type?: string;
  entity_id?: string;
  search?: string;
  department?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
};
export const MAX_EMPLOYEE_CSV_UPLOAD_MB = parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_CSV_MB || '2', 10);
export const MAX_EMPLOYEE_CSV_UPLOAD_BYTES = MAX_EMPLOYEE_CSV_UPLOAD_MB * 1024 * 1024;

export type EmployeeCsvImportResult = {
  created_count: number;
  errors: Array<{ row: number; email?: string; message: string }>;
  summary: string;
};

export function validateEmployeeCsvFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okType = file.type === 'text/csv'
    || file.type === 'application/vnd.ms-excel'
    || file.type === 'text/plain'
    || name.endsWith('.csv');
  if (!okType) return 'Only CSV files are allowed.';
  if (file.size > MAX_EMPLOYEE_CSV_UPLOAD_BYTES) {
    return `CSV must be ${MAX_EMPLOYEE_CSV_UPLOAD_MB} MB or smaller. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`;
  }
  return null;
}

export function validateImageFile(file: File): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) return 'Only JPEG, PNG, WebP, and GIF images are allowed.';
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return `Image must be ${MAX_IMAGE_UPLOAD_MB} MB or smaller. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`;
  }
  return null;
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vms_token');
}

function logoutAndRedirect(reason: string): never {
  localStorage.removeItem('vms_token');
  localStorage.removeItem('vms_user');
  localStorage.removeItem('vms_permissions');
  localStorage.removeItem('vms_assignments');
  localStorage.setItem('vms_logout_reason', reason);
  window.location.href = '/login';
  throw new Error(reason);
}

function rejectIfUnauthorized(
  path: string,
  res: Response,
  data: { error?: string } = {},
): void {
  if (path === '/auth/login' || (res.status !== 401 && res.status !== 403)) return;
  const reason = data.error || (res.status === 403
    ? 'Your account does not have access to the admin portal.'
    : 'Session expired. Please log in again.');
  logoutAndRedirect(reason);
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  rejectIfUnauthorized(path, res, data);
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function mediaSrc(url: string | null | undefined, cacheVersion?: number): string | null {
  if (!url) return null;
  const base = url.startsWith('http') ? url : `${BASE}${url}`;
  if (!cacheVersion) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}v=${cacheVersion}`;
}

/** @deprecated use mediaSrc */
export const profileImageSrc = mediaSrc;

export const api = {
  login:        (body: object)     => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getPermissions: ()              => apiFetch('/auth/permissions'),
  getUsers:   ()                   => apiFetch('/users'),
  getUser:    (id: string)         => apiFetch(`/users/${id}`),
  createUser: (body: object)       => apiFetch('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: object) => apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string)         => apiFetch(`/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string, body: object = {}) => apiFetch(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(body) }),
  getRoles:   ()                   => apiFetch('/roles'),
  getAssignableRoles: (options?: { maxLevel?: number; entityType?: string }) => {
    const qs = new URLSearchParams();
    if (options?.maxLevel != null) qs.set('max_level', String(options.maxLevel));
    if (options?.entityType) qs.set('entity_type', options.entityType);
    const q = qs.toString();
    return apiFetch(`/roles/assignable${q ? `?${q}` : ''}`);
  },
  createRole: (body: object)       => apiFetch('/roles', { method: 'POST', body: JSON.stringify(body) }),
  updateRole: (id: string, body: object) => apiFetch(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRole: (id: string)         => apiFetch(`/roles/${id}`, { method: 'DELETE' }),
  getUserRoles: (id: string)       => apiFetch(`/users/${id}/roles`),
  assignRole: (id: string, body: object) => apiFetch(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify(body) }),
  removeRole: (userId: string, assignmentId: string) => apiFetch(`/users/${userId}/roles/${assignmentId}`, { method: 'DELETE' }),
  uploadProfileImage: async (userId: string, file: File) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/users/${userId}/profile-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const text = await res.text();
    let data: { error?: string; profile_image_url?: string; user?: object } = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(text || 'Upload failed');
    }
    rejectIfUnauthorized(`/users/${userId}/profile-image`, res, data);
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    if (!data.profile_image_url) throw new Error('Upload succeeded but no image URL was returned');
    return data as { profile_image_url: string; user?: object };
  },
  uploadEntityImages: async (entityType: string, entityId: string, files: File[]) => {
    const pathSegment: Record<string, string> = {
      tower: 'towers', company: 'companies', organization: 'organizations', location: 'locations',
    };
    const segment = pathSegment[entityType];
    if (!segment) throw new Error(`Unknown entity type: ${entityType}`);
    if (!files.length) throw new Error('No images selected');

    const token = getToken();
    const formData = new FormData();
    files.forEach(file => formData.append('image', file));
    const res = await fetch(`${BASE}/entities/${segment}/${entityId}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    rejectIfUnauthorized(`/entities/${segment}/${entityId}/image`, res, data);
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  // Entities
  getEmployees: (params: EmployeeListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.entity_type) qs.set('entity_type', params.entity_type);
    if (params.entity_id) qs.set('entity_id', params.entity_id);
    if (params.search) qs.set('search', params.search);
    if (params.department) qs.set('department', params.department);
    if (params.is_active !== undefined) qs.set('is_active', String(params.is_active));
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return apiFetch(`/employees${q ? `?${q}` : ''}`);
  },

  getEmployee: (id: string) => apiFetch(`/employees/${id}`),

  createEmployee: (body: object) =>
    apiFetch('/employees', { method: 'POST', body: JSON.stringify(body) }),

  updateEmployee: (id: string, body: object) =>
    apiFetch(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteEmployee: (id: string) =>
    apiFetch(`/employees/${id}`, { method: 'DELETE' }),

  downloadEmployeeCsvTemplate: async () => {
    const token = getToken();
    const res = await fetch(`${BASE}/entities/employees/csv-template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      rejectIfUnauthorized('/entities/employees/csv-template', res, data);
      throw new Error(data.error || 'Failed to download template');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  uploadEmployeeCsv: async (entityType: string, entityId: string, file: File): Promise<EmployeeCsvImportResult> => {
    const pathSegment: Record<string, string> = {
      tower: 'towers', company: 'companies', organization: 'organizations', location: 'locations',
    };
    const segment = pathSegment[entityType];
    if (!segment) throw new Error(`Unknown entity type: ${entityType}`);

    const token = getToken();
    const formData = new FormData();
    formData.append('csv', file);
    const res = await fetch(`${BASE}/entities/${segment}/${entityId}/employees/csv`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    rejectIfUnauthorized(`/entities/${segment}/${entityId}/employees/csv`, res, data);
    if (data.summary !== undefined) return data as EmployeeCsvImportResult;
    if (!res.ok) throw new Error(data.error || 'Import failed');
    return data as EmployeeCsvImportResult;
  },

  getEntityImages: (entityType: string, entityId: string) => {
    const segment: Record<string, string> = {
      tower: 'towers', company: 'companies', organization: 'organizations', location: 'locations',
    };
    const path = segment[entityType];
    if (!path) throw new Error(`Unknown entity type: ${entityType}`);
    return apiFetch(`/entities/${path}/${entityId}/images`);
  },
  getTowers:          ()                            => apiFetch('/entities/towers'),
  getTower:           (id: string)                  => apiFetch(`/entities/towers/${id}`),
  createTower:        (body: object)                => apiFetch('/entities/towers', { method: 'POST', body: JSON.stringify(body) }),
  updateTower:        (id: string, body: object)    => apiFetch(`/entities/towers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTower:        (id: string)                  => apiFetch(`/entities/towers/${id}`, { method: 'DELETE' }),

  getCompanies:       (towerId?: string)            => apiFetch(`/entities/companies${towerId ? `?tower_id=${towerId}` : ''}`),
  createCompany:      (body: object)                => apiFetch('/entities/companies', { method: 'POST', body: JSON.stringify(body) }),
  updateCompany:      (id: string, body: object)    => apiFetch(`/entities/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCompany:      (id: string)                  => apiFetch(`/entities/companies/${id}`, { method: 'DELETE' }),

  getOrganizations:   ()                            => apiFetch('/entities/organizations'),
  getOrganization:    (id: string)                  => apiFetch(`/entities/organizations/${id}`),
  createOrganization: (body: object)                => apiFetch('/entities/organizations', { method: 'POST', body: JSON.stringify(body) }),
  updateOrganization: (id: string, body: object)    => apiFetch(`/entities/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteOrganization: (id: string)                  => apiFetch(`/entities/organizations/${id}`, { method: 'DELETE' }),

  getLocations:       (orgId?: string)              => apiFetch(`/entities/locations${orgId ? `?organization_id=${orgId}` : ''}`),
  createLocation:     (body: object)                => apiFetch('/entities/locations', { method: 'POST', body: JSON.stringify(body) }),
  updateLocation:     (id: string, body: object)    => apiFetch(`/entities/locations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteLocation:     (id: string)                  => apiFetch(`/entities/locations/${id}`, { method: 'DELETE' }),

  getEntityConfig: (entityType: string, entityId: string) => {
    const segment: Record<string, string> = {
      tower: 'towers', organization: 'organizations', company: 'companies', location: 'locations',
    };
    const path = segment[entityType];
    if (!path) throw new Error(`Unknown entity type: ${entityType}`);
    return apiFetch(`/entities/${path}/${entityId}/config`);
  },

  updateEntityConfig: (entityType: string, entityId: string, config: object) => {
    const segment: Record<string, string> = {
      tower: 'towers', organization: 'organizations', company: 'companies', location: 'locations',
    };
    const path = segment[entityType];
    if (!path) throw new Error(`Unknown entity type: ${entityType}`);
    return apiFetch(`/entities/${path}/${entityId}/config`, { method: 'PATCH', body: JSON.stringify({ config }) });
  },

  /** @deprecated use getEntityConfig */
  getCompanyConfig:   (id: string)                  => apiFetch(`/entities/companies/${id}/config`),
  /** @deprecated use updateEntityConfig */
  updateCompanyConfig:(id: string, config: object)  => apiFetch(`/entities/companies/${id}/config`, { method: 'PATCH', body: JSON.stringify({ config }) }),
  /** @deprecated use getEntityConfig */
  getLocationConfig:  (id: string)                  => apiFetch(`/entities/locations/${id}/config`),
  /** @deprecated use updateEntityConfig */
  updateLocationConfig:(id: string, config: object) => apiFetch(`/entities/locations/${id}/config`, { method: 'PATCH', body: JSON.stringify({ config }) }),
};
