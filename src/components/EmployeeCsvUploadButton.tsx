'use client';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  validateEmployeeCsvFile,
  validateEmployeeCsvHeaders,
  type EmployeeCsvImportResult as CsvImportResult,
} from '@/lib/api';
import { canUploadChildEmployeeCsv, canUploadSelfEmployeeCsv } from '@/lib/auth';
import EmployeeCsvImportResult from '@/components/EmployeeCsvImportResult';

export type EmployeeCsvEntityType = 'tower' | 'company' | 'organization' | 'location';

type Props = {
  mode: 'self' | 'child';
  entityType: EmployeeCsvEntityType;
  entityId: string;
  onImported?: (result: CsvImportResult) => void;
  className?: string;
  showTemplateLink?: boolean;
};

const defaultClass =
  'text-xs text-violet-700 hover:bg-violet-50 border border-violet-200 px-2 py-1 rounded transition-colors disabled:opacity-50';

export default function EmployeeCsvUploadButton({
  mode,
  entityType,
  entityId,
  onImported,
  className,
  showTemplateLink = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    function recheck() {
      setAllowed(mode === 'self' ? canUploadSelfEmployeeCsv() : canUploadChildEmployeeCsv());
    }
    recheck();
    window.addEventListener('vms_permissions_updated', recheck);
    return () => window.removeEventListener('vms_permissions_updated', recheck);
  }, [mode]);

  if (!allowed) return null;

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      await api.downloadEmployeeCsvTemplate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download template');
    } finally {
      setDownloading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileError = validateEmployeeCsvFile(file);
    if (fileError) {
      alert(fileError);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    let csvText: string;
    try {
      csvText = await file.text();
    } catch {
      alert('Could not read the CSV file.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const headerError = validateEmployeeCsvHeaders(csvText);
    if (headerError) {
      alert(headerError);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const importResult = await api.uploadEmployeeCsv(entityType, entityId, file);
      setResult(importResult);
      if (mode === 'child') setShowModal(true);
      onImported?.(importResult);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import employees');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,application/vnd.ms-excel"
        className="hidden"
        onChange={handleFile}
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        {showTemplateLink && downloading && (
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={downloading}
            className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 px-2 py-1 rounded transition-colors disabled:opacity-50"
          >
            {'Downloading…' }
          </button>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={className ?? defaultClass}
          title="Upload a CSV file to import employees"
        >
          {uploading ? 'Importing…' : '📄 Upload CSV'}
        </button>
      </div>

      {mode === 'self' && result && (
        <EmployeeCsvImportResult
          result={result}
          onDismiss={() => setResult(null)}
          className="mt-4"
        />
      )}

      {mode === 'child' && showModal && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-3">Employee CSV Import</h3>
            <EmployeeCsvImportResult result={result} onDismiss={() => setShowModal(false)} />
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-xs px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
