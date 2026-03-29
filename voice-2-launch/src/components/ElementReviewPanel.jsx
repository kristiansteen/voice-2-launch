function Section({ title, children }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

function EditableRow({ fields, onUpdate, onDelete }) {
  return (
    <div className="flex items-center gap-2 mb-1 group">
      {fields.map(({ key, value, type, options, placeholder }) => {
        if (type === 'select') {
          return (
            <select
              key={key}
              value={value}
              onChange={e => onUpdate(key, e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          );
        }
        return (
          <input
            key={key}
            value={value}
            onChange={e => onUpdate(key, e.target.value)}
            placeholder={placeholder || key}
            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        );
      })}
      <button
        onClick={onDelete}
        className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}

function AddButton({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-blue-500 hover:text-blue-700 mt-1"
    >
      + {label}
    </button>
  );
}

let idCounter = 1000;
function newId(prefix) {
  return `${prefix}_${++idCounter}`;
}

export default function ElementReviewPanel({ parsed, setParsed, onGenerateXml }) {
  if (!parsed) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4">
        Parse a transcript to see BPMN elements here.
      </div>
    );
  }

  const update = (section, id, key, value) => {
    setParsed(prev => ({
      ...prev,
      [section]: prev[section].map(el => el.id === id ? { ...el, [key]: value } : el)
    }));
  };

  const remove = (section, id) => {
    setParsed(prev => ({ ...prev, [section]: prev[section].filter(el => el.id !== id) }));
  };

  const add = (section, newEl) => {
    setParsed(prev => ({ ...prev, [section]: [...prev[section], newEl] }));
  };

  const roleOptions = ['null', ...parsed.roles.map(r => r.id)];

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        {/* Roles */}
        <Section title={`Roles (${parsed.roles.length})`}>
          {parsed.roles.map(r => (
            <EditableRow
              key={r.id}
              fields={[{ key: 'name', value: r.name, placeholder: 'Role name' }]}
              onUpdate={(key, val) => update('roles', r.id, key, val)}
              onDelete={() => remove('roles', r.id)}
            />
          ))}
          <AddButton onClick={() => add('roles', { id: newId('role'), name: 'New Role' })} label="Add role" />
        </Section>

        {/* Events */}
        <Section title={`Events (${parsed.events.length})`}>
          {parsed.events.map(e => (
            <EditableRow
              key={e.id}
              fields={[
                { key: 'name', value: e.name, placeholder: 'Event name' },
                { key: 'type', value: e.type, type: 'select', options: ['start', 'end', 'intermediate'] }
              ]}
              onUpdate={(key, val) => update('events', e.id, key, val)}
              onDelete={() => remove('events', e.id)}
            />
          ))}
          <AddButton onClick={() => add('events', { id: newId('event'), type: 'start', name: 'New Event' })} label="Add event" />
        </Section>

        {/* Activities */}
        <Section title={`Activities (${parsed.activities.length})`}>
          {parsed.activities.map(a => (
            <EditableRow
              key={a.id}
              fields={[
                { key: 'name', value: a.name, placeholder: 'Activity name' },
                {
                  key: 'performer',
                  value: a.performer || 'null',
                  type: 'select',
                  options: roleOptions
                }
              ]}
              onUpdate={(key, val) => update('activities', a.id, key, val === 'null' ? null : val)}
              onDelete={() => remove('activities', a.id)}
            />
          ))}
          <AddButton onClick={() => add('activities', { id: newId('act'), name: 'New Activity', performer: null })} label="Add activity" />
        </Section>

        {/* Gateways */}
        <Section title={`Gateways (${parsed.gateways.length})`}>
          {parsed.gateways.map(g => (
            <EditableRow
              key={g.id}
              fields={[
                { key: 'name', value: g.name, placeholder: 'Gateway name' },
                { key: 'type', value: g.type, type: 'select', options: ['exclusive', 'parallel', 'inclusive'] }
              ]}
              onUpdate={(key, val) => update('gateways', g.id, key, val)}
              onDelete={() => remove('gateways', g.id)}
            />
          ))}
          <AddButton onClick={() => add('gateways', { id: newId('gw'), type: 'exclusive', name: 'Gateway?' })} label="Add gateway" />
        </Section>

        {/* Sequence Flows */}
        <Section title={`Sequence Flows (${parsed.sequence_flows.length})`}>
          {parsed.sequence_flows.map(f => (
            <EditableRow
              key={f.id}
              fields={[
                { key: 'from', value: f.from, placeholder: 'from id' },
                { key: 'to', value: f.to, placeholder: 'to id' },
                { key: 'condition', value: f.condition || '', placeholder: 'condition (optional)' }
              ]}
              onUpdate={(key, val) => update('sequence_flows', f.id, key, val || null)}
              onDelete={() => remove('sequence_flows', f.id)}
            />
          ))}
          <AddButton
            onClick={() => add('sequence_flows', { id: newId('flow'), from: '', to: '', condition: null })}
            label="Add flow"
          />
        </Section>
      </div>
      {onGenerateXml && (
        <div className="px-4 py-3 border-t border-gray-200">
          <button
            onClick={onGenerateXml}
            className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white transition-colors"
          >
            Generate XML
          </button>
        </div>
      )}
    </div>
  );

}
