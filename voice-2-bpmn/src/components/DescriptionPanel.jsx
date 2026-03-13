import { useState } from 'react';

function EditableList({ items, onChange, placeholder }) {
  function update(i, val) {
    const next = [...items];
    next[i] = val;
    onChange(next);
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, '']);
  }
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
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700 mt-1">＋ Add {placeholder}</button>
    </div>
  );
}

function RolesList({ roles, onChange }) {
  function update(i, field, val) {
    const next = [...roles];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  }
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
              placeholder="Role name"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 font-medium"
            />
            <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
          </div>
          <textarea
            value={role.responsibilities}
            onChange={e => update(i, 'responsibilities', e.target.value)}
            placeholder="Responsibilities..."
            rows={2}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700">＋ Add role</button>
    </div>
  );
}

function StepsList({ steps, onChange }) {
  function update(i, field, val) {
    const next = [...steps];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  }
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
              placeholder="Step name"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 font-medium"
            />
            <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
          </div>
          <input
            value={step.performer}
            onChange={e => update(i, 'performer', e.target.value)}
            placeholder="Performer"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 text-gray-500"
          />
          <textarea
            value={step.description}
            onChange={e => update(i, 'description', e.target.value)}
            placeholder="Description..."
            rows={2}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700">＋ Add step</button>
    </div>
  );
}

export default function DescriptionPanel({ description, onDescriptionChange, onApprove, loading, canApprove }) {
  const [approvingBpmn, setApprovingBpmn] = useState(false);

  function set(field, val) {
    onDescriptionChange({ ...description, [field]: val });
  }

  async function handleApprove() {
    setApprovingBpmn(true);
    try {
      await onApprove();
    } finally {
      setApprovingBpmn(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2">
        <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        Parsing voice...
      </div>
    );
  }

  if (!description) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          Parse voice to generate description
        </div>
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <button
            disabled
            className="w-full bg-teal-600 text-white text-sm font-medium py-2 rounded-md opacity-40 cursor-not-allowed"
          >
            Approve &amp; Parse BPMN →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Process Name */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Process Name</label>
          <input
            value={description.process_name || ''}
            onChange={e => set('process_name', e.target.value)}
            className="mt-1 w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 font-medium"
          />
        </div>

        {/* Overview */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Overview</label>
          <textarea
            value={description.overview || ''}
            onChange={e => set('overview', e.target.value)}
            rows={3}
            className="mt-1 w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>

        {/* Scope */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scope</label>
          <textarea
            value={description.scope || ''}
            onChange={e => set('scope', e.target.value)}
            rows={2}
            className="mt-1 w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 resize-none"
          />
        </div>

        {/* Roles */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Roles</label>
          <div className="mt-1">
            <RolesList roles={description.roles || []} onChange={val => set('roles', val)} />
          </div>
        </div>

        {/* Steps */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Steps</label>
          <div className="mt-1">
            <StepsList steps={description.steps || []} onChange={val => set('steps', val)} />
          </div>
        </div>

        {/* Exceptions */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Exceptions</label>
          <div className="mt-1">
            <EditableList
              items={description.exceptions || []}
              onChange={val => set('exceptions', val)}
              placeholder="exception"
            />
          </div>
        </div>

        {/* Known Issues */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Known Issues</label>
          <div className="mt-1">
            <EditableList
              items={description.known_issues || []}
              onChange={val => set('known_issues', val)}
              placeholder="known issue"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <button
          onClick={handleApprove}
          disabled={!canApprove || approvingBpmn}
          className="w-full bg-teal-600 text-white text-sm font-medium py-2 rounded-md hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {approvingBpmn ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Parsing BPMN...
            </>
          ) : (
            'Approve & Parse BPMN →'
          )}
        </button>
      </div>
    </div>
  );
}
