import { useEffect } from 'react';

/**
 * Resolve what we know about a clicked BPMN element from the parsed data.
 */
function resolveElement(element, parsed, description) {
  if (!element || !parsed) return null;

  const id   = element.id;
  const name = element.businessObject?.name || element.name || id;
  const type = element.type; // e.g. 'bpmn:Task', 'bpmn:ExclusiveGateway', 'bpmn:StartEvent'

  // Find in parsed structures
  const activity = parsed.activities?.find(a => a.id === id);
  const gateway  = parsed.gateways?.find(g => g.id === id);
  const event    = parsed.events?.find(e => e.id === id);

  // Performer role
  const performer = activity?.performer
    ? parsed.roles?.find(r => r.id === activity.performer)?.name
    : null;

  // Match step description from processDescription by name (best effort)
  const stepDesc = description?.steps?.find(s =>
    s.name?.toLowerCase().includes(name?.toLowerCase()) ||
    name?.toLowerCase().includes(s.name?.toLowerCase())
  );

  // Flows into/out of this element
  const inFlows  = parsed.sequence_flows?.filter(f => f.to   === id) || [];
  const outFlows = parsed.sequence_flows?.filter(f => f.from === id) || [];

  function labelFor(eid) {
    return (
      parsed.activities?.find(a => a.id === eid)?.name ||
      parsed.gateways?.find(g => g.id === eid)?.name ||
      parsed.events?.find(e => e.id === eid)?.name ||
      eid
    );
  }

  return { id, name, type, activity, gateway, event, performer, stepDesc, inFlows, outFlows, labelFor };
}

function typeLabel(type) {
  if (!type) return 'Element';
  if (type.includes('Task'))              return 'Task';
  if (type.includes('ExclusiveGateway')) return 'Exclusive Gateway';
  if (type.includes('ParallelGateway'))  return 'Parallel Gateway';
  if (type.includes('InclusiveGateway')) return 'Inclusive Gateway';
  if (type.includes('StartEvent'))       return 'Start Event';
  if (type.includes('EndEvent'))         return 'End Event';
  if (type.includes('IntermediateThrowEvent') || type.includes('IntermediateCatchEvent')) return 'Intermediate Event';
  return type.replace('bpmn:', '');
}

function typeBadgeColor(type) {
  if (!type) return 'bg-gray-100 text-gray-600';
  if (type.includes('Task'))         return 'bg-blue-50 text-blue-700';
  if (type.includes('Gateway'))      return 'bg-amber-50 text-amber-700';
  if (type.includes('StartEvent'))   return 'bg-green-50 text-green-700';
  if (type.includes('EndEvent'))     return 'bg-red-50 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

export default function StepCurtain({ element, parsed, processDescription, onClose, metrics, onMetricsChange }) {
  const info = resolveElement(element, parsed, processDescription);

  function updateActivityMetric(id, field, rawValue) {
    if (!onMetricsChange) return;
    const value = field === 'backlog' ? (parseInt(rawValue) || 0) : (parseFloat(rawValue) || 0);
    const activities = metrics?.activities || [];
    const existing = activities.find(a => a.id === id);
    const updated = existing
      ? activities.map(a => a.id === id ? { ...a, [field]: value } : a)
      : [...activities, { id, duration_value: 0, duration_unit: 'min', backlog: 0, [field]: value }];
    onMetricsChange({ ...(metrics || { activities: [], gateways: [] }), activities: updated });
  }

  function updateBranchRate(gwId, condition, rawRate) {
    if (!onMetricsChange) return;
    const rate = parseFloat(rawRate) || 0;
    const gateways = metrics?.gateways || [];
    const existing = gateways.find(g => g.id === gwId);
    let updatedGws;
    if (existing) {
      const hasBranch = existing.branches?.find(b => b.condition === condition);
      updatedGws = gateways.map(g => g.id === gwId ? {
        ...g,
        branches: hasBranch
          ? g.branches.map(b => b.condition === condition ? { ...b, rate } : b)
          : [...(g.branches || []), { condition, rate }],
      } : g);
    } else {
      updatedGws = [...gateways, { id: gwId, branches: [{ condition, rate }] }];
    }
    onMetricsChange({ ...(metrics || { activities: [], gateways: [] }), gateways: updatedGws });
  }

  const actMetric = info?.activity ? (metrics?.activities || []).find(a => a.id === info.id) : null;
  const gwMetric  = info?.gateway  ? (metrics?.gateways  || []).find(g => g.id === info.id) : null;

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — click outside to close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Curtain panel */}
      <div
        className="fixed top-0 left-0 z-50 h-screen flex flex-col bg-white shadow-2xl border-r border-gray-200 overflow-hidden"
        style={{ width: '30vw', minWidth: 280, maxWidth: 560 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${typeBadgeColor(info?.type)}`}>
              {typeLabel(info?.type)}
            </span>
            <h2 className="text-base font-semibold text-gray-900 leading-tight">
              {info?.name || element?.businessObject?.name || 'Element'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1 mt-0.5 shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Performer */}
          {info?.performer && (
            <Section label="Performer">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {info.performer[0]}
                </span>
                <span className="text-sm text-gray-800">{info.performer}</span>
              </div>
            </Section>
          )}

          {/* Step description from processDescription */}
          {info?.stepDesc?.description && (
            <Section label="Description">
              <p className="text-sm text-gray-700 leading-relaxed">{info.stepDesc.description}</p>
            </Section>
          )}

          {/* Gateway type note */}
          {info?.gateway && (
            <Section label="Gateway type">
              <p className="text-sm text-gray-700 capitalize">{info.gateway.type}</p>
            </Section>
          )}

          {/* Event type note */}
          {info?.event && (
            <Section label="Event type">
              <p className="text-sm text-gray-700 capitalize">{info.event.type}</p>
            </Section>
          )}

          {/* Incoming flows */}
          {info?.inFlows?.length > 0 && (
            <Section label="Incoming from">
              <ul className="space-y-1">
                {info.inFlows.map(f => (
                  <li key={f.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 text-xs">←</span>
                    <span>{info.labelFor(f.from)}</span>
                    {f.condition && (
                      <span className="ml-auto text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                        {f.condition}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Outgoing flows */}
          {info?.outFlows?.length > 0 && (
            <Section label="Leads to">
              <ul className="space-y-1">
                {info.outFlows.map(f => (
                  <li key={f.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 text-xs">→</span>
                    <span>{info.labelFor(f.to)}</span>
                    {f.condition && (
                      <span className="ml-auto text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                        {f.condition}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* ── Activity metrics ──────────────────────────────────── */}
          {info?.activity && onMetricsChange && (
            <Section label="Metrics">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Duration per case</p>
                  <div className="flex gap-1.5">
                    <input
                      type="number" min={0} step="any"
                      value={actMetric?.duration_value ?? ''}
                      placeholder="e.g. 30"
                      onChange={e => updateActivityMetric(info.id, 'duration_value', e.target.value)}
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
                    />
                    <select
                      value={actMetric?.duration_unit || 'min'}
                      onChange={e => updateActivityMetric(info.id, 'duration_unit', e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
                    >
                      <option value="min">min</option>
                      <option value="hr">hr</option>
                      <option value="day">day</option>
                      <option value="week">week</option>
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Backlog (cases waiting)</p>
                  <input
                    type="number" min={0}
                    value={actMetric?.backlog ?? ''}
                    placeholder="e.g. 120"
                    onChange={e => updateActivityMetric(info.id, 'backlog', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
                  />
                </div>
              </div>
            </Section>
          )}

          {/* ── Gateway branch rates ───────────────────────────────── */}
          {info?.gateway && onMetricsChange && info.outFlows.some(f => f.condition) && (
            <Section label="Route frequency">
              <ul className="space-y-2">
                {info.outFlows.filter(f => f.condition).map(f => {
                  const branch = gwMetric?.branches?.find(b => b.condition === f.condition) || {};
                  return (
                    <li key={f.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700">{f.condition}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number" min={0} max={100} step="1"
                          value={branch.rate ?? ''}
                          placeholder="0"
                          onChange={e => updateBranchRate(info.id, f.condition, e.target.value)}
                          className="w-14 text-sm text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white"
                        />
                        <span className="text-sm text-gray-400">%</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* No data fallback */}
          {!info?.performer && !info?.stepDesc && !info?.gateway && !info?.event && (
            <p className="text-sm text-gray-400 italic">No additional details for this element.</p>
          )}

          {/* Spacer for custom content slot */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Notes</p>
            <textarea
              placeholder="Add notes about this step..."
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-indigo-400 bg-gray-50/60 h-28"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">{label}</p>
      {children}
    </div>
  );
}
