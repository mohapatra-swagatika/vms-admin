'use client';
import type { EmployeeCsvImportResult } from '@/lib/api';

type Props = {
  result: EmployeeCsvImportResult;
  onDismiss?: () => void;
  className?: string;
};

export default function EmployeeCsvImportResult({ result, onDismiss, className }: Props) {
  const hasErrors = result.errors.length > 0;
  const success = result.created_count > 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        success && !hasErrors
          ? 'bg-success-light border-success-border'
          : success && hasErrors
            ? 'bg-warning-light border-warning-border'
            : 'bg-danger-light border-danger-border'
      } ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className={`text-sm font-semibold ${
            success && !hasErrors ? 'text-success' : success ? 'text-warning' : 'text-danger'
          }`}>
            {success && !hasErrors ? '✓ Import successful' : success ? '⚠ Import completed with errors' : '✕ Import failed'}
          </div>
          <p className={`text-sm mt-0.5 ${
            success && !hasErrors ? 'text-success' : success ? 'text-warning' : 'text-danger'
          }`}>
            {result.summary}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-700 text-lg leading-none shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>

      {hasErrors && (
        <div className="mt-3 bg-white/80 border border-inherit rounded-lg overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-inherit">
            Row-level errors ({result.errors.length})
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium w-14">Row</th>
                  <th className="text-left px-3 py-1.5 font-medium">Email</th>
                  <th className="text-left px-3 py-1.5 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((err, i) => (
                  <tr key={`${err.row}-${i}`} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 font-mono text-gray-700">{err.row}</td>
                    <td className="px-3 py-1.5 text-gray-600">{err.email || '—'}</td>
                    <td className="px-3 py-1.5 text-danger">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
