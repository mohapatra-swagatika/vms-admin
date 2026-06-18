export type NotifyRecipient = {
  id: string;
  name: string;
  email: string;
  level: number;
  role_name: string;
  role_display: string;
};

export type NotificationRecipients = {
  gate: NotifyRecipient[];
  front_desk: NotifyRecipient[];
  admin: NotifyRecipient[];
};

export type EntityConfig = {
  whatsapp: boolean;
  email: boolean;
  call: boolean;
  push: boolean;
  notify_gate: boolean;
  notify_front_desk: boolean;
  notify_admin: boolean;
  gate_user_ids: string[];
  front_desk_user_ids: string[];
  request_timeout_minutes: number;
};

export const DEFAULT_ENTITY_CONFIG: EntityConfig = {
  whatsapp: true,
  email: true,
  call: false,
  push: true,
  notify_gate: false,
  notify_front_desk: true,
  notify_admin: true,
  gate_user_ids: [],
  front_desk_user_ids: [],
  request_timeout_minutes: 15,
};

export const MIN_TIMEOUT_MINUTES = 1;
export const MAX_TIMEOUT_MINUTES = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => typeof id === 'string' && UUID_RE.test(id)))];
}

const BOOL_CONFIG_KEYS = [
  'whatsapp', 'email', 'call', 'push',
  'notify_gate', 'notify_front_desk', 'notify_admin',
] as const;

export function normalizeEntityConfig(raw: unknown): EntityConfig {
  const src = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const config = { ...DEFAULT_ENTITY_CONFIG };

  for (const key of BOOL_CONFIG_KEYS) {
    if (typeof src[key] === 'boolean') config[key] = src[key];
  }

  if (src.gate_user_ids !== undefined) config.gate_user_ids = normalizeIdList(src.gate_user_ids);
  if (src.front_desk_user_ids !== undefined) config.front_desk_user_ids = normalizeIdList(src.front_desk_user_ids);

  const timeout = Number(src.request_timeout_minutes);
  if (Number.isFinite(timeout)) {
    config.request_timeout_minutes = Math.min(
      MAX_TIMEOUT_MINUTES,
      Math.max(MIN_TIMEOUT_MINUTES, Math.round(timeout)),
    );
  }

  return config;
}

export const CHANNEL_LABELS: Record<'whatsapp' | 'email' | 'call' | 'push', string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  call: 'Phone call',
  push: 'Push (MWMD)',
};

export type ConfigurableEntityType = 'tower' | 'organization' | 'company' | 'location';

export type ParentEntityConfig = {
  entity_type: ConfigurableEntityType;
  entity_id: string;
  entity_name: string;
  config: EntityConfig;
  recipients: NotificationRecipients;
};

export type EntityConfigResponse = {
  config: EntityConfig;
  recipients: NotificationRecipients;
  parent: ParentEntityConfig | null;
};

export const CONFIG_ENTITY_SEGMENT: Record<ConfigurableEntityType, string> = {
  tower: 'towers',
  organization: 'organizations',
  company: 'companies',
  location: 'locations',
};

/** Empty selection with toggle ON means notify all staff in scope at dispatch time. */
export function effectiveRecipientIds(selected: string[], available: NotifyRecipient[]): string[] {
  if (!available.length) return [];
  if (!selected.length) return available.map(u => u.id);
  const allowed = new Set(available.map(u => u.id));
  return selected.filter(id => allowed.has(id));
}
