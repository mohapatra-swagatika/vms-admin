'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  type EntityConfig,
  type NotificationRecipients,
  type NotifyRecipient,
  type ConfigurableEntityType,
  CHANNEL_LABELS,
  MIN_TIMEOUT_MINUTES,
  MAX_TIMEOUT_MINUTES,
  normalizeEntityConfig,
} from '@/lib/entityConfig';

interface Props {
  entityType: ConfigurableEntityType;
  entityId: string;
  entityName: string;
  onSave: (config: EntityConfig) => Promise<void>;
  onCancel: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none block h-5 w-5 shrink-0 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function RecipientPicker({
  label,
  users,
  selectedIds,
  onChange,
}: {
  label: string;
  users: NotifyRecipient[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!users.length) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        No {label.toLowerCase()} staff in scope yet. Assign users with a role in the matching level band.
      </div>
    );
  }

  function toggleUser(id: string) {
    const base = selectedIds.length === 0 ? users.map(u => u.id) : [...selectedIds];
    if (base.includes(id)) onChange(base.filter(x => x !== id));
    else onChange([...base, id]);
  }

  function selectAll() {
    onChange(users.map(u => u.id));
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</div>
        <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">
          Select all
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        All staff are notified by default. Uncheck anyone who should not receive alerts.
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {users.map(user => {
          const checked = selectedIds.length === 0 || selectedIds.includes(user.id);
          return (
            <label key={user.id} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleUser(user.id)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="min-w-0 flex-1">
              <span className="font-medium">{user.name}</span>
                <span className="text-gray-500 text-xs ml-2">{user.email}</span>
              </span>
              <span className="text-xs text-gray-500 shrink-0 text-right">
                {user.role_display} · L{user.level}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function EntityConfigEditor({
  entityType, entityId, entityName, onSave, onCancel,
}: Props) {
  const [config, setConfig] = useState<EntityConfig | null>(null);
  const [recipients, setRecipients] = useState<NotificationRecipients | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getEntityConfig(entityType, entityId)
      .then((data: { config: EntityConfig; recipients: NotificationRecipients }) => {
        if (cancelled) return;
        setConfig(normalizeEntityConfig(data.config));
        setRecipients(data.recipients);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load configuration');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  function setBool<K extends keyof EntityConfig>(key: K, value: boolean) {
    setConfig(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key === 'notify_gate' && value && recipients && !prev.gate_user_ids.length) {
        next.gate_user_ids = recipients.gate.map(u => u.id);
      }
      if (key === 'notify_front_desk' && value && recipients && !prev.front_desk_user_ids.length) {
        next.front_desk_user_ids = recipients.front_desk.map(u => u.id);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!config || !recipients) return;
    setSaving(true);
    setError('');
    try {
      const payload = { ...config };
      if (payload.notify_gate) {
        const all = recipients.gate.map(u => u.id);
        const picked = payload.gate_user_ids.length === 0 ? all : payload.gate_user_ids;
        if (all.length && !picked.length) {
          setError('Select at least one gate staff member, or turn off Notify Gate.');
          setSaving(false);
          return;
        }
        payload.gate_user_ids = picked.length === all.length ? [] : picked;
      } else {
        payload.gate_user_ids = [];
      }
      if (payload.notify_front_desk) {
        const all = recipients.front_desk.map(u => u.id);
        const picked = payload.front_desk_user_ids.length === 0 ? all : payload.front_desk_user_ids;
        if (all.length && !picked.length) {
          setError('Select at least one front desk staff member, or turn off Notify Front Desk.');
          setSaving(false);
          return;
        }
        payload.front_desk_user_ids = picked.length === all.length ? [] : picked;
      } else {
        payload.front_desk_user_ids = [];
      }
      await onSave(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return (
      <div className="bg-white rounded-2xl border border-primary-border shadow-sm p-6 text-sm text-gray-500">
        Loading configuration…
      </div>
    );
  }

  const gateUsers = recipients?.gate || [];
  const fdUsers = recipients?.front_desk || [];

  return (
    <div className="bg-white rounded-2xl border border-primary-border shadow-sm p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Admin Configuration</h3>
          <p className="text-xs text-gray-500 mt-0.5">{entityName}</p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      {error && (
        <div className="mb-4 alert-danger text-xs px-3 py-2 rounded-lg">{error}</div>
      )}

      <div className="bg-primary-muted border border-primary-border rounded-xl p-4 mb-5 text-xs text-primary">
        Choose who receives alerts for new visitor requests and which delivery channels are used.
        Changes apply immediately to new requests.
      </div>

      <div className="mb-5">
        <div className="text-sm font-semibold text-gray-700 mb-2">Notification recipients</div>
        <div className="border border-gray-200 rounded-xl px-4 divide-y divide-gray-100">
          <div className="py-1">
            <Toggle
              checked={config.notify_gate}
              onChange={v => setBool('notify_gate', v)}
              label="Notify Gate"
              description="Alert gate receptionists when a visitor request is submitted."
            />
            {config.notify_gate && (
              <RecipientPicker
                label="Gate staff"
                users={gateUsers}
                selectedIds={config.gate_user_ids}
                onChange={ids => setConfig(prev => prev ? { ...prev, gate_user_ids: ids } : prev)}
              />
            )}
          </div>
          <div className="py-1">
            <Toggle
              checked={config.notify_front_desk}
              onChange={v => setBool('notify_front_desk', v)}
              label="Notify Front Desk"
              description="Alert front desk staff. Enabled by default."
            />
            {config.notify_front_desk && (
              <RecipientPicker
                label="Front desk staff"
                users={fdUsers}
                selectedIds={config.front_desk_user_ids}
                onChange={ids => setConfig(prev => prev ? { ...prev, front_desk_user_ids: ids } : prev)}
              />
            )}
          </div>
          <Toggle
            checked={config.notify_admin}
            onChange={v => setBool('notify_admin', v)}
            label="Notify Admin / Manager"
            description="Alert admins or org admins based on your approval setup."
          />
        </div>
      </div>

      <div className="mb-5">
        <div className="text-sm font-semibold text-gray-700 mb-2">Delivery channels</div>
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl px-4">
          {(Object.keys(CHANNEL_LABELS) as Array<keyof typeof CHANNEL_LABELS>).map(key => (
            <Toggle
              key={key}
              checked={config[key]}
              onChange={v => setConfig(prev => prev ? { ...prev, [key]: v } : prev)}
              label={CHANNEL_LABELS[key]}
            />
          ))}
        </div>
      </div>

      <div className="mb-5">
        <div className="text-sm font-semibold text-gray-700 mb-2">Request timeout</div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <label className="block text-xs text-gray-600 mb-2">
            Minutes before a pending request is considered unanswered (Gate may act per permissions)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={MIN_TIMEOUT_MINUTES}
              max={MAX_TIMEOUT_MINUTES}
              value={config.request_timeout_minutes}
              onChange={e => setConfig(prev => prev ? {
                ...prev,
                request_timeout_minutes: Math.min(
                  MAX_TIMEOUT_MINUTES,
                  Math.max(MIN_TIMEOUT_MINUTES, parseInt(e.target.value, 10) || MIN_TIMEOUT_MINUTES),
                ),
              } : prev)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
            />
            <span className="text-xs text-gray-500">minutes ({MIN_TIMEOUT_MINUTES}–{MAX_TIMEOUT_MINUTES})</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
