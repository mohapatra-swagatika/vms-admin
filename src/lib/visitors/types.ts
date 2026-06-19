/** Mirrors `visitors` table — keep in sync with vms-backend migration 013_visitors.sql */

export type VisitorEntityType = 'tower' | 'company' | 'organization' | 'location';

export type VisitorStatus = 'pending' | 'approved' | 'rejected';

export type VisitorIdType = 'passport' | 'national_id' | 'driving_license' | 'other';

export type Visitor = {
  id: string;
  entity_type: VisitorEntityType;
  entity_id: string;
  entity_name?: string;
  full_name: string;
  image_url: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  id_type: VisitorIdType | null;
  id_number: string | null;
  purpose: string | null;
  host_name: string | null;
  host_email: string | null;
  host_employee_id: string | null;
  status: VisitorStatus;
  scheduled_arrival: string | null;
  scheduled_departure: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitorListParams = {
  entity_type?: VisitorEntityType;
  entity_id?: string;
  search?: string;
  status?: VisitorStatus;
  page?: number;
  limit?: number;
};

export type VisitorExportParams = Omit<VisitorListParams, 'page' | 'limit'>;

export type VisitorPagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type CreateVisitorInput = {
  entity_type: VisitorEntityType;
  entity_id: string;
  full_name: string;
  image_url?: string | null;
  email?: string;
  phone?: string;
  company_name?: string;
  id_type?: VisitorIdType;
  id_number?: string;
  purpose?: string;
  host_name?: string;
  host_email?: string;
  host_employee_id?: string;
  status?: VisitorStatus;
  scheduled_arrival?: string;
  scheduled_departure?: string;
  notes?: string;
};

export type UpdateVisitorInput = Partial<{
  full_name: string;
  image_url: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  id_type: VisitorIdType | null;
  id_number: string | null;
  purpose: string | null;
  host_name: string | null;
  host_email: string | null;
  host_employee_id: string | null;
  status: VisitorStatus;
  scheduled_arrival: string | null;
  scheduled_departure: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  notes: string | null;
}>;
