import { useState, useRef } from 'react';
import ApiKeyModal from './components/ApiKeyModal.jsx';
import VoicePanel from './components/VoicePanel.jsx';
import DescriptionPanel from './components/DescriptionPanel.jsx';
import DiagramPanel from './components/DiagramPanel.jsx';
import ImprovePanel from './components/ImprovePanel.jsx';
import TaxonomyPanel from './components/TaxonomyPanel.jsx';
import {
  parseVoiceToDescription,
  parseToBpmn,
  getStructuredImprovements,
  generateProjectPlan,
} from './services/anthropicService.js';
import { generateBpmnXml } from './services/xmlGenerator.js';

const DEMO_TRANSCRIPT = `Interviewer: Can you walk me through the invoice approval process?

SME: Sure. When we receive an invoice from a supplier, the Accounts Payable clerk first checks if it matches a purchase order. If it matches, they send it to the relevant department manager for approval. The manager either approves or rejects it. If approved, AP processes the payment. If rejected, they notify the supplier and archive the invoice. If there's no matching PO, AP sends it back to procurement to raise one first.`;

const DEMO_PARSED = {
  process_name: 'Invoice Approval Process',
  roles: [
    { id: 'role_1', name: 'Accounts Payable Clerk' },
    { id: 'role_2', name: 'Department Manager' },
    { id: 'role_3', name: 'Procurement' },
  ],
  events: [
    { id: 'event_1', type: 'start', name: 'Invoice Received' },
    { id: 'event_2', type: 'end',   name: 'Payment Processed' },
    { id: 'event_3', type: 'end',   name: 'Invoice Archived' },
    { id: 'event_4', type: 'end',   name: 'PO Raised' },
  ],
  activities: [
    { id: 'act_1', name: 'Check PO Match',        performer: 'role_1' },
    { id: 'act_2', name: 'Send for Approval',      performer: 'role_1' },
    { id: 'act_3', name: 'Review Invoice',         performer: 'role_2' },
    { id: 'act_4', name: 'Process Payment',        performer: 'role_1' },
    { id: 'act_5', name: 'Notify Supplier',        performer: 'role_1' },
    { id: 'act_6', name: 'Archive Invoice',        performer: 'role_1' },
    { id: 'act_7', name: 'Raise Purchase Order',   performer: 'role_3' },
  ],
  gateways: [
    { id: 'gw_1', type: 'exclusive', name: 'PO Match?' },
    { id: 'gw_2', type: 'exclusive', name: 'Approved?' },
  ],
  sequence_flows: [
    { id: 'flow_1',  from: 'event_1', to: 'act_1',   condition: null },
    { id: 'flow_2',  from: 'act_1',   to: 'gw_1',    condition: null },
    { id: 'flow_3',  from: 'gw_1',    to: 'act_2',   condition: 'Yes' },
    { id: 'flow_4',  from: 'gw_1',    to: 'act_7',   condition: 'No' },
    { id: 'flow_5',  from: 'act_2',   to: 'act_3',   condition: null },
    { id: 'flow_6',  from: 'act_3',   to: 'gw_2',    condition: null },
    { id: 'flow_7',  from: 'gw_2',    to: 'act_4',   condition: 'Approved' },
    { id: 'flow_8',  from: 'gw_2',    to: 'act_5',   condition: 'Rejected' },
    { id: 'flow_9',  from: 'act_4',   to: 'event_2', condition: null },
    { id: 'flow_10', from: 'act_5',   to: 'act_6',   condition: null },
    { id: 'flow_11', from: 'act_6',   to: 'event_3', condition: null },
    { id: 'flow_12', from: 'act_7',   to: 'event_4', condition: null },
  ],
};

const DEMO_DESCRIPTION = {
  process_name: 'Invoice Approval Process',
  overview: 'The invoice approval process covers the receipt, validation, approval, and payment of supplier invoices. It ensures all invoices are matched to valid purchase orders before payment is authorised.',
  scope: 'In scope: invoice receipt through to payment or rejection. Out of scope: purchase order creation (handled by Procurement) and supplier onboarding.',
  roles: [
    { name: 'Accounts Payable Clerk', responsibilities: 'Receives invoices, checks PO match, routes for approval, processes payments, notifies suppliers, archives invoices.' },
    { name: 'Department Manager', responsibilities: 'Reviews and approves or rejects invoices forwarded by AP.' },
    { name: 'Procurement', responsibilities: 'Raises purchase orders when an invoice arrives without a matching PO.' },
  ],
  steps: [
    { order: 1, name: 'Receive Invoice', performer: 'Accounts Payable Clerk', description: 'Invoice is received from supplier via email or post.' },
    { order: 2, name: 'Check PO Match', performer: 'Accounts Payable Clerk', description: 'Clerk checks whether the invoice matches an existing purchase order.' },
    { order: 3, name: 'Route to Manager', performer: 'Accounts Payable Clerk', description: 'If a PO match is found, the invoice is sent to the relevant department manager for approval.' },
    { order: 4, name: 'Approve or Reject', performer: 'Department Manager', description: 'Manager reviews the invoice and either approves or rejects it.' },
    { order: 5, name: 'Process Payment', performer: 'Accounts Payable Clerk', description: 'If approved, AP schedules and processes the payment.' },
    { order: 6, name: 'Notify & Archive', performer: 'Accounts Payable Clerk', description: 'If rejected, AP notifies the supplier and archives the invoice.' },
    { order: 7, name: 'Raise PO', performer: 'Procurement', description: 'If no PO match, AP routes to Procurement who raise a PO before the process can continue.' },
  ],
  exceptions: [
    'Duplicate invoice received — AP checks for duplicates before proceeding.',
    'Manager unavailable — invoice escalates to their deputy after 48 hours.',
  ],
  known_issues: [
    'Manual PO matching is time-consuming and error-prone.',
    'No automated notification to suppliers on rejection status.',
  ],
};

// Draggable divider between two panel wrappers.
function ResizeHandle({ aRef, bRef, disabled, aKey, bKey, onDragEnd }) {
  const [active, setActive] = useState(false);

  function handleMouseDown(e) {
    if (disabled) return;
    e.preventDefault();
    setActive(true);

    const startX = e.clientX;
    const aEl = aRef.current;
    const bEl = bRef.current;
    const aStart = aEl.getBoundingClientRect().width;
    const bStart = bEl.getBoundingClientRect().width;
    const MIN = 160;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      const delta = ev.clientX - startX;
      const newA = Math.max(MIN, Math.min(aStart + delta, aStart + bStart - MIN));
      const newB = aStart + bStart - newA;
      aEl.style.flex = 'none';
      aEl.style.width = newA + 'px';
      bEl.style.flex = 'none';
      bEl.style.width = newB + 'px';
    }

    function onUp() {
      setActive(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const finalA = aEl.getBoundingClientRect().width;
      const finalB = bEl.getBoundingClientRect().width;
      onDragEnd(aKey, finalA, bKey, finalB);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  if (disabled) {
    return <div className="shrink-0 border-r border-gray-700" style={{ width: 1 }} />;
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ width: 5, flexShrink: 0 }}
      className={[
        'border-r border-gray-700 cursor-col-resize transition-colors',
        active ? 'border-green-500/60 bg-green-500/20' : 'hover:border-green-500/50 hover:bg-green-500/10',
      ].join(' ')}
    />
  );
}

function PanelShell({ num, label, action, collapsed, onToggle, children }) {
  if (collapsed) {
    return (
      <div
        className="flex flex-col h-full bg-gray-900 cursor-pointer select-none"
        onClick={onToggle}
        title={`Expand ${label}`}
      >
        <div className="flex-1 flex items-center justify-center">
          <div
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-4"
          >
            <span className="text-xs font-mono">{num}</span>
            <span className="text-xs font-medium tracking-wide">{label}</span>
          </div>
        </div>
        <div className="pb-3 flex justify-center">
          <span className="text-gray-600 text-xs">›</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 bg-gray-900 text-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400">{num}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={onToggle}
            title="Collapse panel"
            className="text-gray-500 hover:text-white transition-colors text-xs px-1"
          >
            ‹
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [collapsed, setCollapsed] = useState({ 1: false, 2: false, 3: false, 4: false, 5: true });
  const [panelWidths, setPanelWidths] = useState({ 1: null, 2: null, 3: null, 4: null, 5: null });

  const p1Ref = useRef(null);
  const p2Ref = useRef(null);
  const p3Ref = useRef(null);
  const p4Ref = useRef(null);
  const p5Ref = useRef(null);
  const pRefs = { 1: p1Ref, 2: p2Ref, 3: p3Ref, 4: p4Ref, 5: p5Ref };

  function getPanelStyle(n) {
    if (collapsed[n]) return { width: 36, flexShrink: 0, flexGrow: 0 };
    const w = panelWidths[n];
    if (w != null) return { width: w, flexShrink: 0, flexGrow: 0 };
    return { flex: 1, minWidth: 0 };
  }

  function handleDragEnd(aKey, newA, bKey, newB) {
    setPanelWidths(prev => ({ ...prev, [aKey]: newA, [bKey]: newB }));
  }

  function togglePanel(n) {
    [p1Ref, p2Ref, p3Ref, p4Ref, p5Ref].forEach(r => {
      if (!r.current) return;
      r.current.style.cssText = '';
    });
    setPanelWidths({ 1: null, 2: null, 3: null, 4: null, 5: null });
    setCollapsed(prev => ({ ...prev, [n]: !prev[n] }));
  }

  // Process context
  const [processContext, setProcessContext] = useState({
    apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null,
  });

  // Panel 1 — Voice
  const [transcript, setTranscript] = useState('');
  const [descParsing, setDescParsing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  // Panel 2 — Description
  const [processDescription, setProcessDescription] = useState(null);
  const [bpmnParsing, setBpmnParsing] = useState(false);

  // Panel 3 — Diagram (parsed BPMN JSON + XML)
  const [parsed, setParsed] = useState(null);
  const [xml, setXml] = useState(null);

  // Panel 4 — Improve
  const [improvements, setImprovements] = useState(null);
  const [selectedImprovementIds, setSelectedImprovementIds] = useState([]);
  const [projectPlan, setProjectPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  function handleLoadDemo() {
    setTranscript(DEMO_TRANSCRIPT);
    setParsed(DEMO_PARSED);
    setProcessDescription(DEMO_DESCRIPTION);
    setProcessContext({ apqcNodeId: '8.6', apqcNodeName: 'Process accounts payable and expense reimbursements', isCustom: false, customLabel: null });
    setXml(null);
    setVoiceError(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setProjectPlan(null);
  }

  async function handleParseVoice() {
    setDescParsing(true);
    setVoiceError(null);
    setProcessDescription(null);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setProjectPlan(null);
    try {
      const desc = await parseVoiceToDescription(transcript, apiKey, processContext);
      setProcessDescription(desc);
    } catch (err) {
      setVoiceError(err.message || 'Failed to parse voice.');
    } finally {
      setDescParsing(false);
    }
  }

  async function handleApproveToBpmn() {
    setBpmnParsing(true);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setProjectPlan(null);
    try {
      const bpmnJson = await parseToBpmn(processDescription, apiKey, processContext);
      setParsed(bpmnJson);
      const generatedXml = generateBpmnXml(bpmnJson);
      setXml(generatedXml);
    } finally {
      setBpmnParsing(false);
    }
  }

  async function handleGetImprovements() {
    const result = await getStructuredImprovements(parsed, apiKey);
    setImprovements(result);
    setSelectedImprovementIds([]);
  }

  function handleToggleSelect(id) {
    setSelectedImprovementIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleGeneratePlan() {
    setPlanLoading(true);
    try {
      const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
      const plan = await generateProjectPlan(parsed, selected, apiKey);
      setProjectPlan(plan);
    } finally {
      setPlanLoading(false);
    }
  }

  const handleProps = { onDragEnd: handleDragEnd };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white tracking-wide">Voice to BPMN</h1>
          <a
            href="https://www.ailean.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="ailean-badge"
          >
            <span>Powered by</span>
            <span className="ailean-logo">AILEAN</span>
          </a>
        </div>
        <button
          onClick={() => setShowApiKeyModal(true)}
          className="flex items-center gap-2 text-xs text-gray-300 hover:text-white border border-gray-600 rounded px-3 py-1.5 hover:border-gray-400 transition-colors"
        >
          {apiKey ? '⚙ API Key ✓' : '⚙ Set API Key'}
        </button>
      </header>

      {/* 5-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel 1 — Voice */}
        <div ref={p1Ref} style={getPanelStyle(1)} className="overflow-hidden">
          <PanelShell num="1" label="Voice" collapsed={collapsed[1]} onToggle={() => togglePanel(1)}>
            {voiceError && (
              <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-xs shrink-0">
                {voiceError}
              </div>
            )}
            <VoicePanel
              transcript={transcript}
              setTranscript={setTranscript}
              onParse={handleParseVoice}
              loading={descParsing}
              canParse={!!transcript.trim() && !!apiKey}
              onLoadDemo={handleLoadDemo}
              processContext={processContext}
              onProcessContextChange={setProcessContext}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[1]} bRef={pRefs[2]} disabled={collapsed[1] || collapsed[2]}
          aKey={1} bKey={2} {...handleProps} />

        {/* Panel 2 — Description */}
        <div ref={p2Ref} style={getPanelStyle(2)} className="overflow-hidden">
          <PanelShell num="2" label="Description" collapsed={collapsed[2]} onToggle={() => togglePanel(2)}>
            <DescriptionPanel
              description={processDescription}
              onDescriptionChange={setProcessDescription}
              onApprove={handleApproveToBpmn}
              loading={descParsing}
              canApprove={!!processDescription && !!apiKey && !bpmnParsing}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[2]} bRef={pRefs[3]} disabled={collapsed[2] || collapsed[3]}
          aKey={2} bKey={3} {...handleProps} />

        {/* Panel 3 — Diagram */}
        <div ref={p3Ref} style={getPanelStyle(3)} className="overflow-hidden">
          <PanelShell num="3" label="Diagram" collapsed={collapsed[3]} onToggle={() => togglePanel(3)}>
            <DiagramPanel xml={xml} onXmlChange={setXml} bpmnLoading={bpmnParsing} />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[3]} bRef={pRefs[4]} disabled={collapsed[3] || collapsed[4]}
          aKey={3} bKey={4} {...handleProps} />

        {/* Panel 4 — Improve */}
        <div ref={p4Ref} style={getPanelStyle(4)} className="overflow-hidden">
          <PanelShell num="4" label="Improve" collapsed={collapsed[4]} onToggle={() => togglePanel(4)}>
            <ImprovePanel
              parsed={parsed}
              apiKey={apiKey}
              improvements={improvements}
              onGetImprovements={handleGetImprovements}
              selectedIds={selectedImprovementIds}
              onToggleSelect={handleToggleSelect}
              projectPlan={projectPlan}
              onGeneratePlan={handleGeneratePlan}
              planLoading={planLoading}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[4]} bRef={pRefs[5]} disabled={collapsed[4] || collapsed[5]}
          aKey={4} bKey={5} {...handleProps} />

        {/* Panel 5 — Taxonomy DB */}
        <div ref={p5Ref} style={getPanelStyle(5)} className="overflow-hidden border-r-0">
          <PanelShell num="5" label="Taxonomy DB" collapsed={collapsed[5]} onToggle={() => togglePanel(5)}>
            <TaxonomyPanel parsed={parsed} processContext={processContext} />
          </PanelShell>
        </div>
      </div>

      {showApiKeyModal && (
        <ApiKeyModal
          apiKey={apiKey}
          onSave={(key) => { setApiKey(key); setShowApiKeyModal(false); }}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
    </div>
  );
}
