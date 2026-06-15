'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type Employee } from '@/lib/api';
import { canDeleteEmployee, canUpdateEmployee } from '@/lib/auth';
import ConfirmDialog from '@/components/ConfirmDialog';
import FlashToast from '@/components/FlashToast';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const ENTITY_LABELS: Record<string, string> = {
  tower: 'Tower',
  company: 'Company',
  organization: 'Organization',
  location: 'Location',
};

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { confirm, dialogProps } = useConfirmDialog();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', employee_code: '', department: '', job_title: '', is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getEmployee(id);
      const emp = data.employee as Employee;
      setEmployee(emp);
      setForm({
        name: emp.name,
        email: emp.email || '',
        phone: emp.phone || '',
        employee_code: emp.employee_code || '',
        department: emp.department || '',
        job_title: emp.job_title || '',
        is_active: emp.is_active,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string) {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canUpdateEmployee()) return;
    setSaving(true);
    setError('');
    try {
      const data = await api.updateEmployee(id, {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        employee_code: form.employee_code || null,
        department: form.department || null,
        job_title: form.job_title || null,
        is_active: form.is_active,
      });
      setEmployee(data.employee);
      setEditing(false);
      flash('Employee updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!canDeleteEmployee()) return;
    const ok = await confirm({
      title: 'Delete employee',
      message: `Delete employee "${employee?.name}"? This cannot be undone.`,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.deleteEmployee(id);
      router.push('/dashboard/employees');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee');
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-gray-400 text-sm">Loading employee…</div>;
  }

  if (!employee) {
    return (
      <div className="p-8">
        <Link href="/dashboard/employees" className="text-sm text-primary hover:underline">← Back to Employees</Link>
        <p className="mt-4 text-danger">{error || 'Employee not found'}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/dashboard/employees" className="text-sm text-primary hover:underline">← Back to Employees</Link>

      <div className="mt-4 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{employee.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ENTITY_LABELS[employee.entity_type]} · {employee.entity_name || employee.entity_id}
          </p>
        </div>
        <div className="flex gap-2">
          {canUpdateEmployee() && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Edit
            </button>
          )}
          {canDeleteEmployee() && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm px-4 py-2 border border-danger-border text-danger rounded-lg hover:bg-danger-light disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 bg-danger-light border border-danger-border text-danger text-sm px-4 py-2 rounded-lg">{error}</div>}
      {success && <div className="mb-4 bg-success-light border border-success-border text-success text-sm px-4 py-2 rounded-lg">{success}</div>}

      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        {editing ? (
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Employee Code</label>
              <input value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
              <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Job Title</label>
              <input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Active employee
              </label>
            </div>
            <div className="col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Email</dt>
              <dd className="text-gray-900 mt-0.5">{employee.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Phone</dt>
              <dd className="text-gray-900 mt-0.5">{employee.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Employee Code</dt>
              <dd className="text-gray-900 mt-0.5 font-mono">{employee.employee_code || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Status</dt>
              <dd className="mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${employee.is_active ? 'bg-success-light text-success' : 'bg-gray-100 text-gray-500'}`}>
                  {employee.is_active ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Department</dt>
              <dd className="text-gray-900 mt-0.5">{employee.department || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Job Title</dt>
              <dd className="text-gray-900 mt-0.5">{employee.job_title || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Entity</dt>
              <dd className="text-gray-900 mt-0.5">
                {ENTITY_LABELS[employee.entity_type]} · {employee.entity_name || employee.entity_id}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Created</dt>
              <dd className="text-gray-900 mt-0.5">{new Date(employee.created_at).toLocaleString()}</dd>
            </div>
          </dl>
        )}
      </section>
      <ConfirmDialog {...dialogProps} />
      <FlashToast message={error} variant="error" onDismiss={() => setError('')} />
      <FlashToast message={success} variant="success" onDismiss={() => setSuccess('')} />
    </div>
  );
}
