import { useEffect, useState } from 'react';

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

function formatDuration(value, unit) {
  const labels = { min: 'min', hr: 'hr', day: 'day', week: 'week' };
  const label = labels[unit] || unit;
  return `${value} ${label}${value !== 1 ? (unit === 'min' ? '' : 's') : ''}`;
}

const DURATION_UNITS = ['min', 'hr', 'day', 'week'];

export default function StepCurtain({ element, parsed, processDescription, metrics, onUpdateMetric, onClose }) {
  const info = resolveElement(element, parsed, processDescription);
  const activityMetrics = metrics?.activities?.find(m => m.id === info?.id);

  const [durationValue, setDurationValue] = useState(activityMetrics?.duration_value ?? '');
  const [durationUnit, setDurationUnit]   = useState(activityMetrics?.duration_unit ?? 'hr');
  const [backlog, setBacklog]             = useState(activityMetrics?.backlog ?? '');

  // Sync if the curtain re-opens for a different element
  useEffect(() => {
    setDurationValue(activityMetrics?.duration_value ?? '');
    setDurationUnit(activityMetrics?.duration_unit ?? 'hr');
    setBacklog(activityMetrics?.backlog ?? '');
  }, [info?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function commitMetric(patch) {
    onUpdateMetric?.(info.id, patch);
  }

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

          {/* Estimates — editable */}
          {activityMetrics && (
            <Section label="Estimates">
              <div className="flex gap-3">
                {/* Duration */}
                <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-blue-400 uppercase tracking-wide font-medium mb-1.5">Duration per case</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={durationValue}
                      onChange={e => setDurationValue(e.target.value)}
                      onBlur={() => commitMetric({ duration_value: Number(durationValue) || 0 })}
                      className="w-14 text-sm font-semibold text-blue-700 bg-white border border-blue-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400 text-center"
                    />
                    <select
                      value={durationUnit}
                      onChange={e => { setDurationUnit(e.target.value); commitMetric({ duration_unit: e.target.value }); }}
                      className="text-xs text-blue-600 bg-white border border-blue-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
                    >
                      {DURATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                {/* Backlog */}
                {activityMetrics.backlog != null && (
                  <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] text-orange-400 uppercase tracking-wide font-medium mb-1.5">Backlog (open cases)</p>
                    <input
                      type="number"
                      min="0"
                      value={backlog}
                      onChange={e => setBacklog(e.target.value)}
                      onBlur={() => commitMetric({ backlog: Number(backlog) || 0 })}
                      className="w-20 text-sm font-semibold text-orange-700 bg-white border border-orange-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-orange-400 text-center"
                    />
                  </div>
                )}
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

          {/* No data fallback */}
          {!info?.performer && !activityMetrics && !info?.stepDesc && !info?.gateway && !info?.event && (
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
