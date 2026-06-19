'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  getScopedEntity,
  getScopedEntityLabel,
  isSupport,
  resolveGalleryMode,
  type ScopedEntityType,
} from '@/lib/auth';
import EntityGalleryPanel from '@/components/EntityGalleryPanel';
import type { EntityImageType } from '@/components/EntityImageUploadButton';

type EntityOption = { id: string; name: string };

const ENTITY_TYPES: { value: EntityImageType; label: string }[] = [
  { value: 'tower', label: 'Tower' },
  { value: 'organization', label: 'Organization' },
  { value: 'company', label: 'Company' },
  { value: 'location', label: 'Location' },
];

function parseEntityType(raw: string | null): EntityImageType | null {
  if (raw === 'tower' || raw === 'company' || raw === 'organization' || raw === 'location') {
    return raw;
  }
  return null;
}

export default function GalleryPageContent() {
  const searchParams = useSearchParams();
  const scoped = getScopedEntity();
  const support = isSupport();

  const [entityType, setEntityType] = useState<EntityImageType | ''>('');
  const [entityId, setEntityId] = useState('');
  const [entityName, setEntityName] = useState<string | null>(null);
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const initFromParams = useCallback(() => {
    const type = parseEntityType(searchParams.get('type'));
    const id = searchParams.get('id');
    if (type && id) {
      setEntityType(type);
      setEntityId(id);
      return;
    }
    if (scoped) {
      setEntityType(scoped.type);
      setEntityId(scoped.id);
    }
  }, [searchParams, scoped]);

  useEffect(() => {
    initFromParams();
  }, [initFromParams]);

  useEffect(() => {
    if (!support || !entityType) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setOptionsLoading(true);

    (async () => {
      try {
        let rows: EntityOption[] = [];
        if (entityType === 'tower') {
          const { towers } = await api.getTowers();
          rows = (towers as { id: string; name: string }[]).map(t => ({ id: t.id, name: t.name }));
        } else if (entityType === 'organization') {
          const { organizations } = await api.getOrganizations();
          rows = (organizations as { id: string; name: string }[]).map(o => ({ id: o.id, name: o.name }));
        } else if (entityType === 'company') {
          const { companies } = await api.getCompanies();
          rows = (companies as { id: string; name: string }[]).map(c => ({ id: c.id, name: c.name }));
        } else if (entityType === 'location') {
          const { locations } = await api.getLocations();
          rows = (locations as { id: string; name: string }[]).map(l => ({ id: l.id, name: l.name }));
        }
        if (!cancelled) {
          setOptions(rows);
          if (entityId && rows.some(r => r.id === entityId)) {
            setEntityName(rows.find(r => r.id === entityId)?.name ?? null);
          }
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [support, entityType, entityId]);

  const mode = useMemo(() => {
    if (!entityType || !entityId) return 'child' as const;
    return resolveGalleryMode(entityType, entityId);
  }, [entityType, entityId]);

  const ready = Boolean(entityType && entityId);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gallery Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload and remove slider images shown on the dashboard and mobile app.
        </p>
      </div>

      {support && (
        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Select entity</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={entityType}
              onChange={e => {
                const next = e.target.value as EntityImageType | '';
                setEntityType(next);
                setEntityId('');
                setEntityName(null);
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Entity type…</option>
              {ENTITY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={entityId}
              onChange={e => {
                const id = e.target.value;
                setEntityId(id);
                setEntityName(options.find(o => o.id === id)?.name ?? null);
              }}
              disabled={!entityType || optionsLoading}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white disabled:opacity-50"
            >
              <option value="">
                {optionsLoading ? 'Loading…' : 'Select entity…'}
              </option>
              {options.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </section>
      )}

      {!support && scoped && (
        <section className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600">
          Managing gallery for your {getScopedEntityLabel(scoped.type as ScopedEntityType).toLowerCase()}.
        </section>
      )}

      {ready ? (
        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <EntityGalleryPanel
            entityType={entityType as EntityImageType}
            entityId={entityId}
            entityName={entityName}
            mode={mode}
          />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
          {support ? 'Select an entity to manage its gallery images.' : 'No scoped entity found for your account.'}
        </section>
      )}
    </div>
  );
}
