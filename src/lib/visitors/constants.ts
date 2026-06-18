import type { VisitorIdType, VisitorStatus } from './types';

export const VISITOR_STATUS_LABELS: Record<VisitorStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const VISITOR_STATUS_STYLES: Record<VisitorStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-success-light text-success',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-500',
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
