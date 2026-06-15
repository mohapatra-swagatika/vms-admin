'use client';
import { useState } from 'react';

export type ApprovalStep = {
  step: number;
  level: number;
  label: string;
};

export type ApprovalChain = {
  bypass_enabled: boolean;
  steps: ApprovalStep[];
};

// Levels meaningful for visitor approval
const APPROVER_LEVELS = [
  { level: 400,  label: 'Admin (L400)'              },
  { level: 600,  label: 'Company / Location (L600)' },
  { level: 800,  label: 'Tower / Org (L800)'        },
  { level: 1000, label: 'Support (L1000)'           },
];

interface Props {
  entityName: string;
  initial:    ApprovalChain;
  onSave:     (chain: ApprovalChain) => Promise<void>;
  onCancel:   () => void;
}

export default function ApprovalChainEditor({ entityName, initial, onSave, onCancel }: Props) {
  const [bypass, setBypass] = useState(initial.bypass_enabled);
  const [steps,  setSteps]  = useState<ApprovalStep[]>(
    initial.steps.length
      ? [...initial.steps].sort((a, b) => a.step - b.step)
      : []
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function addStep() {
    const nextStep = steps.length ? Math.max(...steps.map(s => s.step)) + 1 : 1;
    setSteps([...steps, { step: nextStep, level: 400, label: '' }]);
  }

  function removeStep(idx: number) {
    const updated = steps.filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, step: i + 1 }));          // renumber
    setSteps(updated);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const updated = [...steps];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setSteps(updated.map((s, i) => ({ ...s, step: i + 1 })));
  }

  function moveDown(idx: number) {
    if (idx === steps.length - 1) return;
    const updated = [...steps];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    setSteps(updated.map((s, i) => ({ ...s, step: i + 1 })));
  }

  function updateStep(idx: number, field: keyof ApprovalStep, value: string | number) {
    setSteps(steps.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await onSave({ bypass_enabled: bypass, steps });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-primary-border shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Approval Chain</h3>
          <p className="text-xs text-gray-500 mt-0.5">{entityName}</p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      {error && (
        <div className="mb-4 alert-danger text-xs px-3 py-2 rounded-lg">{error}</div>
      )}

      {/* Bypass toggle */}
      <div className="bg-warning-light border border-warning-border rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-warning">Bypass Enabled</div>
            <div className="text-xs text-warning mt-0.5 max-w-sm">
              When ON: a higher-level approver can approve in one step, automatically bypassing all lower steps.
              <br />
              <span className="font-medium">Example:</span> Tower approves → Admin step skipped automatically.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={bypass}
            onClick={() => setBypass(!bypass)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              bypass ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none block h-5 w-5 shrink-0 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                bypass ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {bypass && (
          <div className="mt-2 text-xs text-warning bg-warning-light border border-warning-border rounded px-2 py-1">
            ✓ Bypass is <strong>enabled</strong> — high-level approvals will automatically skip lower steps.
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-700">
            Approval Steps ({steps.length})
          </div>
          <button onClick={addStep}
            className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary-hover">
            + Add Step
          </button>
        </div>

        {steps.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center text-gray-400 text-sm">
            No steps yet. Add a step to require approvals before visits are allowed.
            <br />
            <span className="text-xs mt-1 block">Without steps, visitors are auto-approved.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, idx) => (
              <div key={idx}
                className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                {/* Step number */}
                <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {step.step}
                </div>

                {/* Approver level */}
                <select
                  value={step.level}
                  onChange={e => updateStep(idx, 'level', parseInt(e.target.value))}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white"
                >
                  {APPROVER_LEVELS.map(l => (
                    <option key={l.level} value={l.level}>{l.label}</option>
                  ))}
                </select>

                {/* Label */}
                <input
                  value={step.label}
                  onChange={e => updateStep(idx, 'label', e.target.value)}
                  placeholder="Label (optional, e.g. Security check)"
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary bg-white"
                />

                {/* Move up / down */}
                <div className="flex gap-0.5">
                  <button onClick={() => moveUp(idx)} disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs">▲</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === steps.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs">▼</button>
                </div>

                {/* Remove */}
                <button onClick={() => removeStep(idx)}
                  className="text-danger hover:text-danger/80 text-sm px-1">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {steps.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 mb-5 text-xs">
          <div className="text-gray-500 font-semibold mb-2">Flow preview</div>
          <div className="flex items-center flex-wrap gap-1">
            <span className="bg-success-light text-success px-2 py-0.5 rounded-full">Visitor submits</span>
            {steps.map((s, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-gray-400">→</span>
                <span className="bg-primary-muted text-primary border border-primary-border px-2 py-0.5 rounded-full">
                  Step {s.step}: L{s.level}{s.label ? ` (${s.label})` : ''}
                </span>
              </span>
            ))}
            <span className="text-gray-400">→</span>
            <span className="bg-success-light text-success px-2 py-0.5 rounded-full">Approved ✓</span>
          </div>
          {bypass && steps.length > 1 && (
            <div className="mt-2 text-warning">
              ⚡ Bypass ON — L{Math.max(...steps.map(s => s.level))} approval skips all lower steps
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Approval Chain'}
        </button>
      </div>
    </div>
  );
}
