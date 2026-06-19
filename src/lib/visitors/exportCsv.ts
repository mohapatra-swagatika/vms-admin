import {
  ENTITY_TYPE_LABELS,
  VISITOR_STATUS_LABELS,
} from './constants';
import type { Visitor } from './types';

const EXPORT_HEADERS = [
  'Full Name',
  'Email',
  'Phone',
  'Purpose',
  'Host Name',
  'Host Email',
  'Entity Type',
  'Entity',
  'Status',
  'Checked In',
  'Checked Out',
] as const;

function escapeCsvCell(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function formatExportDateTime(value: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function visitorToRow(v: Visitor): string[] {
  return [
    v.full_name,
    v.email ?? '',
    v.phone ?? '',
    v.purpose ?? '',
    v.host_name ?? '',
    v.host_email ?? '',
    ENTITY_TYPE_LABELS[v.entity_type],
    v.entity_name ?? v.entity_id,
    VISITOR_STATUS_LABELS[v.status],
    formatExportDateTime(v.checked_in_at),
    formatExportDateTime(v.checked_out_at),
  ];
}

export function visitorsToCsv(visitors: Visitor[]): string {
  const lines = [
    EXPORT_HEADERS.join(','),
    ...visitors.map(v => visitorToRow(v).map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadVisitorsCsv(visitors: Visitor[], filename?: string) {
  const csv = visitorsToCsv(visitors);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `visitors-export-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
