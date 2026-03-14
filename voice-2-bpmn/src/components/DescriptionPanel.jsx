import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import ApqcSelector from './ApqcSelector.jsx';

function EditableList({ items, onChange, itemKey }) {
  const { t } = useLang();
  const placeholder = t[itemKey] || itemKey;
  function update(i, val) { const n = [...items]; n[i] = val; onChange(n); }
  function remove(i) { onChange(items.filter((_, idx) => idx !== i)); }
  function add() { onChange([...items, '']); }
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1">
          <input
            value={item}
            onChange={e => update(i, e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
          />
          <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
        {t.addItem} {placeholder}
      </button>
    </div>
  );
}

function RolesList({ roles, onChange }) {
  const { t } = useLang();
  function update(i, field, val) { const n = [...roles]; n[i] = { ...n[i], [field]: val }; onChange(n); }
  function remove(i) { onChange(roles.filter((_, idx) => idx !== i)); }
  function add() { onChange([...roles, { name: '', responsibilities: '' }]); }
  return (
    <div className="space-y-2">
      {roles.map((role, i) => (
        <div key={i} className="border border-gray-100 rounded p-2 space-y-1">
          <div className="flex gap-1">
            <input
              value={role.name}
              onChange={e => update(i, 'name', e.target.value)}
              placeholder={t.roleName}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 font-medium"
            />
            <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
          </div>
          <textarea
            value={role.responsibilities}
            onChange={e => update(i, 'responsibilities', e.target.value)}
            placeholder={t.responsibilities}
            rows={2}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700">{t.addRole}</button>
    </div>
  );
}

function StepsList({ steps, onChange }) {
  const { t } = useLang();
  function update(i, field, val) { const n = [...steps]; n[i] = { ...n[i], [field]: val }; onChange(n); }
  function remove(i) { onChange(steps.filter((_, idx) => idx !== i)); }
  function add() {
    const order = steps.length ? Math.max(...steps.map(s => s.order)) + 1 : 1;
    onChange([...steps, { order, name: '', performer: '', description: '' }]);
  }
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="border border-gray-100 rounded p-2 space-y-1">
          <div className="flex gap-1 items-center">
            <span className="text-xs text-gray-400 w-5 shrink-0">{step.order}.</span>
            <input
              value={step.name}
              onChange={e => update(i, 'name', e.target.value)}
              placeholder={t.stepName}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 font-medium"
            />
            <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
          </div>
          <input
            value={step.performer}
            onChange={e => update(i, 'performer', e.target.value)}
            placeholder={t.performer}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 text-gray-500"
          />
          <textarea
            value={step.description}
            onChange={e => update(i, 'description', e.target.value)}
            placeholder={t.stepDesc}
            rows={2}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700">{t.addStep}</button>
    </div>
  );
}

export default function DescriptionPanel({ description, onDescriptionChange, onApprove, loading, canApprove, processContext, onProcessContextChange }) {
  const { t } = useLang();
  const [approvingBpmn, setApprovingBpmn] = useState(false);

  function set(field, val) { onDescriptionChange({ ...description, [field]: val }); }

  async function handleApprove() {
    setApprovingBpmn(true);
    try { await onApprove(); } finally { setApprovingBpmn(false); }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2">
        <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        {t.parsingVoiceDot}
      </div>
    );
  }

  if (!description) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          {t.parseVoiceFirst}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <button disabled className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md opacity-40 cursor-not-allowed">
            {t.approveBpmn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── APQC preselector ──────────────────────────────────── */}
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <ApqcSelector
            processContext={processContext}
            onChange={onProcessContextChange}
          />
        </div>

        {/* ── Process name with optional APQC mapping ───────────── */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.processName}</label>
          <div className="mt-1 flex gap-1.5 items-stretch">
            <input
              value={description.process_name || ''}
              onChange={e => set('process_name', e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 font-medium"
            />
            {processContext?.apqcNodeName && (
              <button
                onClick={() => set('process_name', processContext.apqcNodeName)}
                title={`Use APQC name: ${processContext.apqcNodeName}`}
                className="shrink-0 text-[10px] font-medium px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors leading-tight"
              >
                ← Use APQC
              </button>
            )}
          </div>
          {processContext?.apqcNodeName && (
            <p className="mt-1 text-[10px] text-gray-400 truncate">
              <span className="font-mono">{processContext.apqcNodeId}</span> — {processContext.apqcNodeName}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.overview}</label>
          <textarea value={description.overview || ''} onChange={e => set('overview', e.target.value)} rows={3}
            className="mt-1 w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.scope}</label>
          <textarea value={description.scope || ''} onChange={e => set('scope', e.target.value)} rows={2}
            className="mt-1 w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.roles}</label>
          <div className="mt-1">
            <RolesList roles={description.roles || []} onChange={val => set('roles', val)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.steps}</label>
          <div className="mt-1">
            <StepsList steps={description.steps || []} onChange={val => set('steps', val)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.exceptions}</label>
          <div className="mt-1">
            <EditableList items={description.exceptions || []} onChange={val => set('exceptions', val)} itemKey="exceptionItem" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.knownIssues}</label>
          <div className="mt-1">
            <EditableList items={description.known_issues || []} onChange={val => set('known_issues', val)} itemKey="knownIssueItem" />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <button
          onClick={handleApprove}
          disabled={!canApprove || approvingBpmn}
          className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {approvingBpmn ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t.parsingBpmn}
            </>
          ) : (
            t.approveBpmn
          )}
        </button>
      </div>
    </div>
  );
}
