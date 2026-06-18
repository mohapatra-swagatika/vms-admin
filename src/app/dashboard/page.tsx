'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  can,
  canReadEmployees,
  canReadVisitors,
  getAssignments,
  getUser,
  getTopScope,
  getScopedEntity,
  getScopedEntityLabel,
  isSupport,
  type ScopedEntityType,
} from '@/lib/auth';
import { api } from '@/lib/api';
import { readEntityGalleryCache, writeEntityGalleryCache } from '@/lib/entityGalleryCache';
import EntityImageCarousel, { type EntityImage } from '@/components/EntityImageCarousel';
import EntityImageUploadButton from '@/components/EntityImageUploadButton';
import EmployeeCsvUploadButton from '@/components/EmployeeCsvUploadButton';
import {
  Building,
  Building2,
  Contact,
  KeyRound,
  MapPin,
  Store,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { visitorsClient } from '@/lib/visitors';

type Assignment = ReturnType<typeof getAssignments>[number];

type OverviewStat = {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

async function resolveScopeName(scopeType: string, scopeId: string | null): Promise<string | null> {
  if (!scopeId) return null;
  try {
    if (scopeType === 'tower') {
      const { towers } = await api.getTowers();
      return towers.find((t: { id: string }) => t.id === scopeId)?.name ?? null;
    }
    if (scopeType === 'company') {
      const { companies } = await api.getCompanies();
      return companies.find((c: { id: string }) => c.id === scopeId)?.name ?? null;
    }
    if (scopeType === 'organization') {
      const { organizations } = await api.getOrganizations();
      return organizations.find((o: { id: string }) => o.id === scopeId)?.name ?? null;
    }
    if (scopeType === 'location') {
      const { locations } = await api.getLocations();
      return locations.find((l: { id: string }) => l.id === scopeId)?.name ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

function roleBadgeClass(level: number) {
  if (level >= 1000) return 'bg-red-500/15 text-red-700 ring-red-500/20';
  if (level >= 800) return 'bg-teal-500/15 text-teal-700 ring-teal-500/20';
  if (level >= 600) return 'bg-blue-500/15 text-blue-700 ring-blue-500/20';
  if (level >= 400) return 'bg-amber-500/15 text-amber-700 ring-amber-500/20';
  return 'bg-gray-500/10 text-gray-600 ring-gray-500/15';
}

function scopeLabel(scopeType: string) {
  if (scopeType === 'global') return 'Global';
  return getScopedEntityLabel(scopeType as ScopedEntityType);
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function HeroSkeleton() {
  return (
    <section
      className="aspect-[21/9] min-h-[200px] sm:min-h-[260px] rounded-2xl bg-gray-200/80 animate-pulse border border-gray-200/80"
      aria-hidden
    />
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [topRole, setTopRole] = useState<ReturnType<typeof getTopScope>>(null);
  const [support, setSupport] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scopeNames, setScopeNames] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<OverviewStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [scopedEntityName, setScopedEntityName] = useState('');
  const [scopedEntity, setScopedEntity] = useState<ReturnType<typeof getScopedEntity>>(null);
  const [entityImages, setEntityImages] = useState<EntityImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [entityUploadProgress, setEntityUploadProgress] = useState<number | null>(null);
  const [today, setToday] = useState('');

  const loadEntityGallery = useCallback(async (entity: NonNullable<ReturnType<typeof getScopedEntity>>) => {
    const cached = readEntityGalleryCache(entity.type, entity.id);
    if (cached) {
      setScopedEntityName(cached.entity_name ?? getScopedEntityLabel(entity.type));
      setEntityImages(cached.images ?? []);
      setImagesLoading(false);
    } else {
      setImagesLoading(true);
    }

    try {
      const [name, data] = await Promise.all([
        resolveScopeName(entity.type, entity.id),
        api.getEntityImages(entity.type, entity.id),
      ]);
      const resolvedName = name ?? data.entity_name ?? getScopedEntityLabel(entity.type);
      const images = data.images ?? [];
      setScopedEntityName(resolvedName);
      setEntityImages(images);
      writeEntityGalleryCache(entity.type, entity.id, { entity_name: resolvedName, images });
    } catch {
      if (!cached) {
        setScopedEntityName(getScopedEntityLabel(entity.type));
        setEntityImages([]);
      }
    } finally {
      setImagesLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    setToday(todayLabel());
    setUser(getUser());
    setTopRole(getTopScope());
    setAssignments(getAssignments());

    const scoped = getScopedEntity();
    setScopedEntity(scoped);
    setSupport(isSupport());

    const top = getTopScope();

    if (scoped) loadEntityGallery(scoped);

    async function loadScopeNames() {
      const items = getAssignments();
      const entries = await Promise.all(
        items
          .filter(a => a.scope_id)
          .map(async a => {
            const name = await resolveScopeName(a.scope_type, a.scope_id);
            return name ? [`${a.scope_type}:${a.scope_id}`, name] as const : null;
          }),
      );
      setScopeNames(Object.fromEntries(entries.filter(Boolean) as [string, string][]));
    }

    async function loadStats() {
      setStatsLoading(true);
      const next: OverviewStat[] = [];

      try {
        if (can('user:read')) {
          const { pagination } = await api.getUsers({ limit: 1, page: 1 });
          next.push({
            label: 'Users', value: String(pagination?.total ?? 0), href: '/dashboard/users',
            icon: Users, accent: 'from-blue-500/10 to-indigo-500/5 border-blue-200/60',
          });
        }

        if (canReadEmployees()) {
          const params = scoped
            ? { entity_type: scoped.type, entity_id: scoped.id, limit: 1, page: 1 }
            : { limit: 1, page: 1 };
          const { pagination } = await api.getEmployees(params);
          next.push({
            label: 'Employees', value: String(pagination?.total ?? 0), href: '/dashboard/employees',
            icon: Contact, accent: 'from-emerald-500/10 to-teal-500/5 border-emerald-200/60',
          });
        }

        if (canReadVisitors()) {
          const params = scoped
            ? { entity_type: scoped.type, limit: 1, page: 1 }
            : { limit: 1, page: 1 };
          const { pagination } = await visitorsClient.listVisitors(params);
          next.push({
            label: 'Visitors', value: String(pagination?.total ?? 0), href: '/dashboard/visitors',
            icon: UserCheck, accent: 'from-orange-500/10 to-rose-500/5 border-orange-200/60',
          });
        }

        if (can('entity:read')) {
          if (isSupport()) {
            const [{ towers }, { organizations }, { companies }, { locations }] = await Promise.all([
              api.getTowers(), api.getOrganizations(), api.getCompanies(), api.getLocations(),
            ]);
            next.push(
              { label: 'Towers', value: String(towers.length), href: '/dashboard/entities', icon: Building, accent: 'from-teal-500/10 to-cyan-500/5 border-teal-200/60' },
              { label: 'Organizations', value: String(organizations.length), href: '/dashboard/entities', icon: Building2, accent: 'from-violet-500/10 to-purple-500/5 border-violet-200/60' },
              { label: 'Companies', value: String(companies.length), href: '/dashboard/entities', icon: Store, accent: 'from-sky-500/10 to-blue-500/5 border-sky-200/60' },
              { label: 'Locations', value: String(locations.length), href: '/dashboard/entities', icon: MapPin, accent: 'from-amber-500/10 to-orange-500/5 border-amber-200/60' },
            );
          } else if (top?.scope_type === 'tower' && top.scope_id) {
            const { companies } = await api.getCompanies(top.scope_id);
            next.push({ label: 'Companies', value: String(companies.length), href: '/dashboard/entities', icon: Store, accent: 'from-sky-500/10 to-blue-500/5 border-sky-200/60' });
          } else if (top?.scope_type === 'organization' && top.scope_id) {
            const { locations } = await api.getLocations(top.scope_id);
            next.push({ label: 'Locations', value: String(locations.length), href: '/dashboard/entities', icon: MapPin, accent: 'from-amber-500/10 to-orange-500/5 border-amber-200/60' });
          }
        }

        if (can('role:read')) {
          const { roles } = await api.getRoles({ limit: 100 });
          const custom = (roles ?? []).filter((r: { is_system: boolean }) => !r.is_system);
          next.push({
            label: 'Custom roles', value: String(custom.length), href: '/dashboard/roles',
            icon: KeyRound, accent: 'from-fuchsia-500/10 to-pink-500/5 border-fuchsia-200/60',
          });
        }
      } catch { /* best-effort */ }

      setStats(next);
      setStatsLoading(false);
    }

    loadScopeNames();
    loadStats();
  }, [loadEntityGallery]);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {!mounted ? (
          <HeroSkeleton />
        ) : scopedEntity ? (
          <section>
            <EntityImageCarousel
              entityName={scopedEntityName || getScopedEntityLabel(scopedEntity.type)}
              images={entityImages}
              loading={imagesLoading}
              uploadProgress={entityUploadProgress}
              hero
              autoPlay
              overlay={(
                <div className="pointer-events-auto">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {topRole && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                        {topRole.display_name}
                      </span>
                    )}
                    {entityImages.length > 0 && (
                      <span className="text-[10px] font-medium text-white/60">
                        {entityImages.length} image{entityImages.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                    {scopedEntityName || getScopedEntityLabel(scopedEntity.type)}
                  </h1>
                  <p className="text-sm text-white/75 mt-1">
                    {getScopedEntityLabel(scopedEntity.type)} · Welcome back, {user?.name?.split(' ')[0] || 'there'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Link
                      href="/dashboard/entities"
                      className="inline-flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Manage entity
                      <span aria-hidden>→</span>
                    </Link>
                    <EntityImageUploadButton
                      entityType={scopedEntity.type}
                      entityId={scopedEntity.id}
                      onUploaded={() => loadEntityGallery(scopedEntity)}
                      onProgressChange={setEntityUploadProgress}
                      className="text-xs text-white/90 hover:text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/25 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>
              )}
            />
          </section>
        ) : (
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 shadow-lg">
            <div className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.3) 0%, transparent 40%)',
              }}
            />
            <div className="relative px-6 sm:px-8 py-10 sm:py-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-300/80 mb-2">
                {today}
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Welcome back, {user?.name?.split(' ')[0] || 'there'}
                </h1>
                {topRole && (
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ring-1 ${roleBadgeClass(topRole.level)}`}>
                    {topRole.display_name}
                  </span>
                )}
              </div>
              <p className="text-sm text-blue-100/80 max-w-xl">
                {support
                  ? 'Full system console — manage towers, organizations, users, and visitor workflows across the platform.'
                  : user?.email}
              </p>
            </div>
          </section>
        )}

        {scopedEntity && (
          <section className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/80 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Import Employees</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Upload a CSV to add employees to your {getScopedEntityLabel(scopedEntity.type).toLowerCase()}.
                </p>
              </div>
              <EmployeeCsvUploadButton
                mode="self"
                entityType={scopedEntity.type}
                entityId={scopedEntity.id}
                showTemplateLink
                className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              />
            </div>
          </section>
        )}

        {(statsLoading || stats.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Overview</h2>
              <span className="text-xs text-gray-400">Live counts from your scope</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {statsLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-[88px] rounded-xl bg-white/60 border border-gray-200/80 animate-pulse" />
                  ))
                : stats.map(({ label, value, href, icon: Icon, accent }) => (
                    <Link
                      key={label}
                      href={href}
                      className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${accent} p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Icon className="w-5 h-5 text-gray-500 opacity-80 group-hover:scale-110 transition-transform" aria-hidden />
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
                          View →
                        </span>
                      </div>
                      <div className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
                      <div className="text-xs font-medium text-gray-600">{label}</div>
                    </Link>
                  ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {assignments.length > 0 && (
            <section className="lg:col-span-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Role assignments</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{assignments.length} active role{assignments.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <ul className="divide-y divide-gray-50">
                {assignments.map((a, i) => {
                  const scopeKey = a.scope_id ? `${a.scope_type}:${a.scope_id}` : null;
                  const entityName = scopeKey ? scopeNames[scopeKey] : null;
                  return (
                    <li key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/80 transition-colors">
                      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ring-1 ${roleBadgeClass(a.level)}`}>
                        L{a.level}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{a.display_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {a.scope_type === 'global'
                            ? 'Global access'
                            : entityName
                              ? `${scopeLabel(a.scope_type)} · ${entityName}`
                              : scopeLabel(a.scope_type)}
                        </div>
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md ring-1 ${roleBadgeClass(a.level)}`}>
                        {a.role_name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className={`${assignments.length > 0 ? 'lg:col-span-2' : 'lg:col-span-5'} bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/80 shadow-sm p-5`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Session</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
                <dt className="text-gray-500">Signed in as</dt>
                <dd className="font-medium text-gray-900 text-right truncate">{user?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-700 text-right truncate text-xs">{user?.email ?? '—'}</dd>
              </div>
              {topRole && (
                <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Primary role</dt>
                  <dd className="font-medium text-gray-900">{topRole.display_name}</dd>
                </div>
              )}
              {scopedEntity && (
                <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
                  <dt className="text-gray-500">Scope</dt>
                  <dd className="text-gray-900 text-right">
                    {getScopedEntityLabel(scopedEntity.type)}
                    {scopedEntityName ? ` · ${scopedEntityName}` : ''}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-gray-500">Today</dt>
                <dd className="text-gray-700">{today || '—'}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
