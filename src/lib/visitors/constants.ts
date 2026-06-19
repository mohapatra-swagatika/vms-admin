import type { VisitorIdType, VisitorStatus } from './types';

export const VISITOR_STATUS_LABELS: Record<VisitorStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const VISITOR_STATUS_STYLES: Record<VisitorStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-success-light text-success',
  rejected: 'bg-danger-light text-danger',
};

export const VISITOR_ID_TYPE_LABELS: Record<VisitorIdType, string> = {
  passport: 'Passport',
  national_id: 'National ID',
  driving_license: 'Driving license',
  other: 'Other',
};

export const ENTITY_TYPE_LABELS = {
  tower: 'Tower',
  company: 'Company',
  organization: 'Organization',
  location: 'Location',
} as const;
