'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  getUser, getPermissions, getScopedEntity, getScopedEntityLabel,
  type ScopedEntityType,
} from '@/lib/auth';
import { api } from '@/lib/api';
import { useProfileImage } from '@/hooks/useProfileImage';
import SelfProfileImageUpload from '@/components/SelfProfileImageUpload';
import EntityImageUploadButton from '@/components/EntityImageUploadButton';
import EmployeeCsvUploadButton from '@/components/EmployeeCsvUploadButton';
import EntityImageCarousel, { type EntityImage } from '@/components/EntityImageCarousel';
import EntityAvatar from '@/components/EntityAvatar';
import { readEntityGalleryCache, writeEntityGalleryCache } from '@/lib/entityGalleryCache';
import Link from 'next/link';

export default function DashboardPage() {
  const [user, setUser]                   = useState<{ id: string; name: string; email: string; phone?: string } | null>(null);
  const { url: profileImage, version: profileVersion, onUploaded } = useProfileImage();
  const [perms, setPerms]                 = useState<string[]>([]);
  const [scopedEntity, setScopedEntity]   = useState<ReturnType<typeof getScopedEntity>>(null);
  const [entityName, setEntityName]       = useState('');
  const [entityImages, setEntityImages]   = useState<EntityImage[]>([]);
  const [entityImagesLoading, setEntityImagesLoading] = useState(false);
  const [entityUploadProgress, setEntityUploadProgress] = useState<number | null>(null);

  const loadEntityGallery = useCallback(async (entity: NonNullable<ReturnType<typeof getScopedEntity>>) => {
    const cached = readEntityGalleryCache(entity.type, entity.id);
    if (cached) {
      setEntityName(cached.entity_name ?? getScopedEntityLabel(entity.type));
      setEntityImages(cached.images ?? []);
      setEntityImagesLoading(false);
    } else {
      setEntityImagesLoading(true);
    }

    try {
      const data = await api.getEntityImages(entity.type, entity.id);
      const name = data.entity_name ?? getScopedEntityLabel(entity.type);
      const images = data.images ?? [];
      setEntityName(name);
      setEntityImages(images);
      writeEntityGalleryCache(entity.type, entity.id, { entity_name: name, images });
    } catch {
      if (!cached) {
        setEntityName(getScopedEntityLabel(entity.type));
        setEntityImages([]);
      }
    } finally {
      setEntityImagesLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    setPerms(getPermissions());

    const entity = getScopedEntity();
    setScopedEntity(entity);

    if (entity) loadEntityGallery(entity);
  }, [loadEntityGallery]);

  const cards = [
    { label: 'Manage Entities', desc: 'Towers, organizations, companies & locations', href: '/dashboard/entities', icon: '🏢', color: 'teal'  },
    { label: 'Manage Users',      desc: 'Create, edit and assign roles to users',         href: '/dashboard/users',      icon: '👥', color: 'blue'   },
    { label: 'Manage Employees',  desc: 'Employee records by entity — create, import, edit', href: '/dashboard/employees', icon: '👷', color: 'teal'  },
    { label: 'Manage Roles',    desc: 'View system roles and create custom roles',    href: '/dashboard/roles',    icon: '🔑', color: 'purple' },
  ];

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name || '—'}</h1>
        <p className="text-sm text-gray-500 mt-1">VMS Admin Portal · Support Console</p>
      </div>

      {/* Profile — single user profile image (image:upload_self) */}
      {/* <section className="max-w-2xl bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <EntityAvatar name={user?.name ?? '?'} imageUrl={profileImage} imageVersion={profileVersion} size="lg" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Your Profile</h2>
              <p className="text-sm text-gray-600 mt-0.5">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <SelfProfileImageUpload onUploaded={onUploaded} />
        </div>
      </section> */}

      {/* Entity gallery — multiple images per entity (image:upload_child) */}
      {scopedEntity && (
        <section className="max-w-3xl bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {getScopedEntityLabel(scopedEntity.type)} Images
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">{entityName || '…'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Multiple images for your {getScopedEntityLabel(scopedEntity.type).toLowerCase()}
              </p>
            </div>
            <EntityImageUploadButton
              entityType={scopedEntity.type}
              entityId={scopedEntity.id}
              onUploaded={() => loadEntityGallery(scopedEntity)}
              onProgressChange={setEntityUploadProgress}
              className="text-xs text-primary hover:bg-primary-muted border border-primary-border px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            />
          </div>
          <EntityImageCarousel
            entityName={entityName || getScopedEntityLabel(scopedEntity.type)}
            images={entityImages}
            loading={entityImagesLoading}
            uploadProgress={entityUploadProgress}
          />
        </section>
      )}

      {/* Employee CSV import — own scoped entity (employee:csv_upload_self) */}
      {scopedEntity && (
        <section className="max-w-3xl bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Import Employees</h2>
              <p className="text-sm text-gray-600 mt-0.5">{entityName || '…'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload a CSV to add employees to your {getScopedEntityLabel(scopedEntity.type).toLowerCase()}.
                Required column: name. Optional: email, phone, employee_code, department, job_title.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mb-10">
        {cards.map(c => (
          <Link key={c.href} href={c.href}
            className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-primary-border hover:shadow-sm transition-all group"
          >
            <div className="text-3xl mb-3">{c.icon}</div>
            <div className="text-base font-semibold text-gray-900 group-hover:text-primary">{c.label}</div>
            <div className="text-xs text-gray-500 mt-1">{c.desc}</div>
          </Link>
        ))}
      </div>

      {/* <div className="max-w-2xl bg-white rounded-2xl border border-gray-200 p-6">
        <div className="text-sm font-semibold text-gray-700 mb-3">Your Permissions ({perms.length})</div>
        <div className="flex flex-wrap gap-1.5">
          {perms.map(p => (
            <span key={p} className="inline-block bg-primary-muted text-primary text-xs px-2 py-0.5 rounded-full font-mono">{p}</span>
          ))}
        </div>
      </div> */}
    </div>
  );
}
