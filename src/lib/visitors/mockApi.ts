/**
 * In-memory visitors client — mirrors the future REST API contract.
 * Swap implementations in `client.ts` when `/visitors` endpoints are live.
 */

import { getTopScope, isSupport } from '@/lib/auth';
import type { ScopedEntityType } from '@/lib/auth';
import { MOCK_VISITORS } from './mockData';
import type {
  CreateVisitorInput,
  UpdateVisitorInput,
  Visitor,
  VisitorEntityType,
  VisitorListParams,
  VisitorPagination,
  VisitorStatus,
} from './types';

let store: Visitor[] = MOCK_VISITORS.map(v => ({ ...v }));

function delay(ms = 120) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function newId() {
  return `v${crypto.randomUUID().slice(1)}`;
}

function paginate<T>(items: T[], page: number, limit: number): { items: T[]; pagination: VisitorPagination } {
  const total = items.length;
  const total_pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), total_pages);
  const start = (safePage - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: { page: safePage, limit, total, total_pages },
  };
}

/** Align mock records with real entity IDs from the API so filters work in the UI. */
export function remapMockVisitorsToEntities(
  options: Array<{ id: string; name: string; type: VisitorEntityType }>,
) {
  const byType = new Map<VisitorEntityType, Array<{ id: string; name: string }>>();
  for (const opt of options) {
    const list = byType.get(opt.type) ?? [];
    list.push({ id: opt.id, name: opt.name });
    byType.set(opt.type, list);
  }

  const counters: Partial<Record<VisitorEntityType, number>> = {};
  store = store.map(visitor => {
    const pool = byType.get(visitor.entity_type);
    if (!pool?.length) return visitor;
    const idx = counters[visitor.entity_type] ?? 0;
    counters[visitor.entity_type] = idx + 1;
    const target = pool[idx % pool.length];
    return { ...visitor, entity_id: target.id, entity_name: target.name };
  });
}

function visibleEntityTypesForUser(): VisitorEntityType[] | null {
  if (isSupport()) return null;
  const top = getTopScope();
  const st = top?.scope_type;
  if (st === 'tower') return ['tower', 'company'];
  if (st === 'organization') return ['organization', 'location'];
  if (st === 'company') return ['company'];
  if (st === 'location') return ['location'];
  return null;
}

function matchesUserScope(visitor: Visitor): boolean {
  const allowedTypes = visibleEntityTypesForUser();
  if (!allowedTypes) return true;

  if (!allowedTypes.includes(visitor.entity_type)) return false;

  const top = getTopScope();
  if (!top?.scope_id) return true;

  if (top.scope_type === 'tower') {
    if (visitor.entity_type === 'tower') return visitor.entity_id === top.scope_id;
    return visitor.entity_type === 'company';
  }
  if (top.scope_type === 'organization') {
    if (visitor.entity_type === 'organization') return visitor.entity_id === top.scope_id;
    return visitor.entity_type === 'location';
  }
  if (top.scope_type === 'company' || top.scope_type === 'location') {
    return visitor.entity_id === top.scope_id;
  }
  return true;
}

function matchesSearch(visitor: Visitor, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    visitor.full_name,
    visitor.email,
    visitor.phone,
    visitor.company_name,
    visitor.host_name,
    visitor.purpose,
    visitor.id_number,
    visitor.entity_name,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

function filterVisitors(params: VisitorListParams): Visitor[] {
  let rows = store.filter(matchesUserScope);

  if (params.entity_type) {
    rows = rows.filter(v => v.entity_type === params.entity_type);
    if (params.entity_id) {
      rows = rows.filter(v => v.entity_id === params.entity_id);
    }
  }

  if (params.status) {
    rows = rows.filter(v => v.status === params.status);
  }

  if (params.search) {
    rows = rows.filter(v => matchesSearch(v, params.search!));
  }

  return rows.sort((a, b) => {
    const aTime = a.scheduled_arrival ?? a.created_at;
    const bTime = b.scheduled_arrival ?? b.created_at;
    return bTime.localeCompare(aTime);
  });
}

export const visitorsClient = {
  async listVisitors(params: VisitorListParams = {}) {
    await delay();
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const filtered = filterVisitors(params);
    const { items, pagination } = paginate(filtered, page, limit);
    return { visitors: items, pagination };
  },

  async getVisitor(id: string) {
    await delay();
    const visitor = store.find(v => v.id === id);
    if (!visitor || !matchesUserScope(visitor)) {
      throw new Error('Visitor not found');
    }
    return { visitor };
  },

  async createVisitor(input: CreateVisitorInput) {
    await delay();
    const now = new Date().toISOString();
    const visitor: Visitor = {
      id: newId(),
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      full_name: input.full_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      company_name: input.company_name ?? null,
      id_type: input.id_type ?? null,
      id_number: input.id_number ?? null,
      purpose: input.purpose ?? null,
      host_name: input.host_name ?? null,
      host_employee_id: input.host_employee_id ?? null,
      status: input.status ?? 'pending',
      scheduled_arrival: input.scheduled_arrival ?? null,
      scheduled_departure: input.scheduled_departure ?? null,
      checked_in_at: null,
      checked_out_at: null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    store = [visitor, ...store];
    return { visitor };
  },

  async updateVisitor(id: string, patch: UpdateVisitorInput) {
    await delay();
    const idx = store.findIndex(v => v.id === id);
    if (idx === -1 || !matchesUserScope(store[idx])) {
      throw new Error('Visitor not found');
    }
    const current = store[idx];
    const updated: Visitor = {
      ...current,
      ...patch,
      email: patch.email !== undefined ? (patch.email || null) : current.email,
      phone: patch.phone !== undefined ? (patch.phone || null) : current.phone,
      company_name: patch.company_name !== undefined ? (patch.company_name || null) : current.company_name,
      id_type: patch.id_type !== undefined ? (patch.id_type ?? null) : current.id_type,
      id_number: patch.id_number !== undefined ? (patch.id_number || null) : current.id_number,
      purpose: patch.purpose !== undefined ? (patch.purpose || null) : current.purpose,
      host_name: patch.host_name !== undefined ? (patch.host_name || null) : current.host_name,
      host_employee_id: patch.host_employee_id !== undefined ? (patch.host_employee_id ?? null) : current.host_employee_id,
      scheduled_arrival: patch.scheduled_arrival !== undefined ? (patch.scheduled_arrival ?? null) : current.scheduled_arrival,
      scheduled_departure: patch.scheduled_departure !== undefined ? (patch.scheduled_departure ?? null) : current.scheduled_departure,
      notes: patch.notes !== undefined ? (patch.notes || null) : current.notes,
      updated_at: new Date().toISOString(),
    };
    store[idx] = updated;
    return { visitor: updated };
  },

  async deleteVisitor(id: string) {
    await delay();
    const idx = store.findIndex(v => v.id === id);
    if (idx === -1 || !matchesUserScope(store[idx])) {
      throw new Error('Visitor not found');
    }
    store = store.filter(v => v.id !== id);
    return { ok: true as const };
  },

  /** Reset store to seed data (dev/demo helper). */
  resetMockData() {
    store = MOCK_VISITORS.map(v => ({ ...v }));
  },
};

export type { VisitorStatus, ScopedEntityType };
