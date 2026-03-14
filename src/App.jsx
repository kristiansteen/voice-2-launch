import { useState, useRef, useEffect } from 'react';
import HelpModal from './components/HelpModal.jsx';
import LangSwitcher from './components/LangSwitcher.jsx';
import BurgerMenu from './components/BurgerMenu.jsx';
import { useLang } from './i18n/LangContext.jsx';
import VoicePanel from './components/VoicePanel.jsx';
import DescriptionPanel from './components/DescriptionPanel.jsx';
import DiagramPanel from './components/DiagramPanel.jsx';
import ImprovePanel from './components/ImprovePanel.jsx';
import LaunchPanel from './components/LaunchPanel.jsx';
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

const DEMO_IMPROVEMENTS = [
  { id: 'imp_1', title: 'Automate PO Matching', category: 'automation', effort: 'medium', effort_score: 45, impact_score: 85, description: 'Implement automated 3-way matching between invoice, PO, and goods receipt.', benefit: 'Reduces manual checking time by ~70% and eliminates matching errors.' },
  { id: 'imp_2', title: 'Digital Approval Workflow', category: 'efficiency', effort: 'low', effort_score: 25, impact_score: 75, description: 'Replace email-based approvals with an in-system approval queue with auto-escalation.', benefit: 'Cuts approval cycle time from days to hours; provides full audit trail.' },
  { id: 'imp_3', title: 'Supplier Self-Service Portal', category: 'clarity', effort: 'high', effort_score: 75, impact_score: 70, description: 'Allow suppliers to submit invoices digitally and track payment status.', benefit: 'Reduces inbound queries by ~50% and improves supplier relationships.' },
];

const DEMO_PROJECT_PLAN = {
  plan_name: 'Invoice Approval Improvement Plan',
  process_name: 'Invoice Approval Process',
  duration_weeks: 12,
  tracks: [
    { id: 'track_1', name: 'Technology' },
    { id: 'track_2', name: 'Process' },
    { id: 'track_3', name: 'Change Management' },
  ],
  tasks: [
    { id: 'task_1', title: 'Requirements & vendor selection', track_id: 'track_1', week_start: 1, week_end: 3, owner: 'IT Lead', improvement_id: 'imp_1' },
    { id: 'task_2', title: 'Configure PO matching rules', track_id: 'track_1', week_start: 3, week_end: 6, owner: 'IT Lead', improvement_id: 'imp_1' },
    { id: 'task_3', title: 'Design approval workflow', track_id: 'track_2', week_start: 1, week_end: 2, owner: 'Finance Manager', improvement_id: 'imp_2' },
    { id: 'task_4', title: 'Deploy digital approval system', track_id: 'track_1', week_start: 4, week_end: 7, owner: 'IT Lead', improvement_id: 'imp_2' },
    { id: 'task_5', title: 'Update SOP documentation', track_id: 'track_2', week_start: 6, week_end: 8, owner: 'AP Manager', improvement_id: 'imp_2' },
    { id: 'task_6', title: 'UAT and parallel run', track_id: 'track_1', week_start: 8, week_end: 10, owner: 'IT + Finance', improvement_id: 'imp_1' },
    { id: 'task_7', title: 'Staff training', track_id: 'track_3', week_start: 9, week_end: 11, owner: 'HR + Finance', improvement_id: 'imp_2' },
    { id: 'task_8', title: 'Go-live and hypercare', track_id: 'track_1', week_start: 11, week_end: 12, owner: 'IT Lead', improvement_id: 'imp_1' },
  ],
  risks: [
    { id: 'risk_1', title: 'ERP integration delays', probability: 60, consequence: 70, mitigation: 'Engage vendor early; agree integration spec by week 2.' },
    { id: 'risk_2', title: 'Low user adoption', probability: 40, consequence: 60, mitigation: 'Run change champion programme; mandatory training sign-off.' },
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
    return <div className="shrink-0 border-r border-gray-700" style={{ width: 0 }} />;
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
  const { t } = useLang();
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
            title={t.collapsePanel}
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

const DRAFT_KEY = 'voice2bpmn_draft';

export default function App() {
  const { t } = useLang();
  const [apiKey, setApiKey] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showBurger, setShowBurger] = useState(false);

  // ── Custom taxonomy (overrides APQC in ApqcSelector) ──────────────
  const [customTaxonomyNodes, setCustomTaxonomyNodes] = useState(() => {
    try {
      const s = localStorage.getItem('voice2bpmn_custom_taxonomy');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  // ── vimpl login state ──────────────────────────────────────────────
  const VIMPL_STORAGE_KEY = 'voice2bpmn_vimpl_config';
  const VIMPL_LOGIN_URL = 'https://frontend-puce-ten-18.vercel.app/login.html';
  const BACKEND_URL = 'https://backend-eight-rho-46.vercel.app';
  const [vimplToken, setVimplToken] = useState(() => {
    try { return JSON.parse(localStorage.getItem(VIMPL_STORAGE_KEY) || '{}').token || null; }
    catch { return null; }
  });
  const [collapsed, setCollapsed] = useState({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: true });
  // Widths stored as fractions (0–1) of the flex container so redistribution is
  // always proportional and never dependent on a measured pixel value.
  const [panelWidths, setPanelWidths] = useState({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
  const [draftRestored, setDraftRestored] = useState(false);

  const p1Ref = useRef(null);
  const p2Ref = useRef(null);
  const p3Ref = useRef(null);
  const p4Ref = useRef(null);
  const p5Ref = useRef(null);
  const p6Ref = useRef(null);
  const pRefs = { 1: p1Ref, 2: p2Ref, 3: p3Ref, 4: p4Ref, 5: p5Ref, 6: p6Ref };

  // All panels share space equally (flex:1) when all are open.
  // When any panel collapses, non-Map panels are frozen at their current pixel
  // width and Map (panel 3) flexes to fill all freed space.
  function getPanelStyle(n) {
    if (collapsed[n]) return { width: 36, flexShrink: 0, flexGrow: 0 };
    const w = panelWidths[n];
    if (w != null) return { flex: 'none', width: w, minWidth: '20%' };
    return { flex: 1, minWidth: '20%' };
  }

  function handleDragEnd(aKey, newA, bKey, newB) {
    setPanelWidths(prev => ({ ...prev, [aKey]: newA, [bKey]: newB }));
  }

  function togglePanel(n) {
    const nextCollapsed = { ...collapsed, [n]: !collapsed[n] };
    const anyCollapsed = Object.values(nextCollapsed).some(Boolean);

    [p1Ref, p2Ref, p3Ref, p4Ref, p5Ref, p6Ref].forEach(r => {
      if (r.current) r.current.style.cssText = '';
    });

    if (anyCollapsed) {
      // Freeze non-Map panels at their current rendered width; Map fills the rest
      const newWidths = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
      [1, 2, 4, 5, 6].forEach(p => {
        if (!nextCollapsed[p] && pRefs[p].current) {
          newWidths[p] = pRefs[p].current.offsetWidth;
        }
      });
      // panel 3 (Map) stays null → flex:1 → fills remainder
      setPanelWidths(newWidths);
    } else {
      // All open → reset to equal widths
      setPanelWidths({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
    }

    setCollapsed(nextCollapsed);
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

  // Panel 4 — Plan
  const [improvements, setImprovements] = useState(null);
  const [selectedImprovementIds, setSelectedImprovementIds] = useState([]);
  const [customRisks, setCustomRisks] = useState([]);
  const [projectPlan, setProjectPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  // ── Auto-login: read token from ?token= (vimpl SSO callback) or #token= (board deep-link) ──
  useEffect(() => {
    try {
      // Query param — set by vimpl login callback
      const qParams = new URLSearchParams(window.location.search);
      const qToken = qParams.get('token');
      // Hash param — set by vimpl board burger menu
      const hParams = new URLSearchParams(window.location.hash.slice(1));
      const hToken = hParams.get('token');
      const hBaseUrl = hParams.get('baseUrl');
      const token = qToken || hToken;
      if (token) {
        const existing = JSON.parse(localStorage.getItem(VIMPL_STORAGE_KEY) || '{}');
        localStorage.setItem(VIMPL_STORAGE_KEY, JSON.stringify({
          ...existing,
          token,
          ...(hBaseUrl ? { baseUrl: hBaseUrl } : {}),
        }));
        setVimplToken(token);
        // Clean token from URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loginWithGoogle() {
    const returnTo = window.location.href.split('?')[0];
    const state = btoa(JSON.stringify({ returnTo }));
    window.location.href = `${BACKEND_URL}/api/v1/auth/google?state=${encodeURIComponent(state)}`;
  }

  function loginWithVimpl() {
    const returnTo = window.location.href.split('?')[0];
    window.location.href = `${VIMPL_LOGIN_URL}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function logoutVimpl() {
    localStorage.removeItem(VIMPL_STORAGE_KEY);
    setVimplToken(null);
  }

  // ── Restore draft from localStorage on mount ──────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!saved) return;
      if (saved.transcript) setTranscript(saved.transcript);
      if (saved.processDescription) setProcessDescription(saved.processDescription);
      if (saved.parsed) setParsed(saved.parsed);
      if (saved.xml) setXml(saved.xml);
      if (saved.improvements) setImprovements(saved.improvements);
      if (saved.selectedImprovementIds) setSelectedImprovementIds(saved.selectedImprovementIds);
      if (saved.customRisks) setCustomRisks(saved.customRisks);
      if (saved.projectPlan) setProjectPlan(saved.projectPlan);
      if (saved.processContext) setProcessContext(saved.processContext);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 3000);
    } catch { /* ignore corrupt drafts */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save draft whenever key state changes ────────────────────
  useEffect(() => {
    if (!transcript && !xml && !parsed) return; // nothing worth saving yet
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        transcript, processDescription, parsed, xml,
        improvements, selectedImprovementIds, customRisks, projectPlan, processContext,
      }));
    } catch { /* storage full or unavailable */ }
  }, [transcript, processDescription, parsed, xml, improvements, selectedImprovementIds, customRisks, projectPlan, processContext]);

  function handleClearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setTranscript('');
    setProcessDescription(null);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setCustomRisks([]);
    setProjectPlan(null);
    setProcessContext({ apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
  }

  function handleLoadDemo() {
    setTranscript(DEMO_TRANSCRIPT);
    setParsed(DEMO_PARSED);
    setProcessDescription(DEMO_DESCRIPTION);
    setProcessContext({ apqcNodeId: '8.6', apqcNodeName: 'Process accounts payable and expense reimbursements', isCustom: false, customLabel: null });
    setXml(null);
    setVoiceError(null);
    setImprovements(DEMO_IMPROVEMENTS);
    setSelectedImprovementIds(DEMO_IMPROVEMENTS.map(i => i.id));
    setProjectPlan(DEMO_PROJECT_PLAN);
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

  function handleAddImprovement(idea) {
    setImprovements(prev => [...(prev || []), idea]);
    setSelectedImprovementIds(prev => [...prev, idea.id]);
  }

  function handleUpdateImprovement(updated) {
    setImprovements(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  function handleAddRisk(risk) {
    setCustomRisks(prev => [...prev, risk]);
  }

  function handleUpdateRisk(updated) {
    setCustomRisks(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  function handleRemoveRisk(id) {
    setCustomRisks(prev => prev.filter(r => r.id !== id));
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
      const plan = await generateProjectPlan(parsed, selected, apiKey, customRisks);
      setProjectPlan(plan);
    } finally {
      setPlanLoading(false);
    }
  }

  const handleProps = { onDragEnd: handleDragEnd };

  // ── Login gate ────────────────────────────────────────────────────
  if (!vimplToken) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-900 gap-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-semibold text-white tracking-wide">{t.appTitle}</h1>
          <a href="https://www.ailean.dk" target="_blank" rel="noopener noreferrer" className="ailean-badge">
            <span>Powered by</span>
            <span className="ailean-logo">AILEAN</span>
          </a>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 w-80">
          <p className="text-sm text-gray-500 text-center">Sign in to continue</p>

          {/* Google — primary */}
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* vimpl email/password — secondary */}
          <button
            onClick={loginWithVimpl}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign in with vimpl account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white tracking-wide">{t.appTitle}</h1>
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
        <div className="flex items-center gap-2">
          {draftRestored && (
            <span className="text-xs text-green-400 animate-pulse">{t.draftRestored}</span>
          )}
          {(transcript || xml) && (
            <button
              onClick={handleClearDraft}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              title={t.clearTitle}
            >
              {t.clear}
            </button>
          )}
          <LangSwitcher />
          <button
            onClick={() => setShowHelp(true)}
            className="w-6 h-6 rounded-full border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors text-xs font-semibold flex items-center justify-center"
            title="How to get started"
          >
            ?
          </button>
          <button
            onClick={() => setShowBurger(true)}
            className="flex flex-col gap-1 items-center justify-center w-8 h-8 rounded hover:bg-gray-700 transition-colors"
            title="Settings"
          >
            <span className="w-4 h-0.5 bg-gray-300 rounded" />
            <span className="w-4 h-0.5 bg-gray-300 rounded" />
            <span className="w-4 h-0.5 bg-gray-300 rounded" />
          </button>
        </div>
      </header>

      {/* 5-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel 1 — Voice */}
        <div ref={p1Ref} style={getPanelStyle(1)} className="overflow-hidden">
          <PanelShell num="1" label={t.panel1} collapsed={collapsed[1]} onToggle={() => togglePanel(1)}>
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
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[1]} bRef={pRefs[2]} disabled={collapsed[1] || collapsed[2]}
          aKey={1} bKey={2} {...handleProps} />

        {/* Panel 2 — Description */}
        <div ref={p2Ref} style={getPanelStyle(2)} className="overflow-hidden">
          <PanelShell num="2" label={t.panel2} collapsed={collapsed[2]} onToggle={() => togglePanel(2)}>
            <DescriptionPanel
              description={processDescription}
              onDescriptionChange={setProcessDescription}
              onApprove={handleApproveToBpmn}
              loading={descParsing}
              canApprove={!!processDescription && !!apiKey && !bpmnParsing}
              processContext={processContext}
              onProcessContextChange={setProcessContext}
              taxonomyNodes={customTaxonomyNodes}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[2]} bRef={pRefs[3]} disabled={collapsed[2] || collapsed[3]}
          aKey={2} bKey={3} {...handleProps} />

        {/* Panel 3 — Diagram */}
        <div ref={p3Ref} style={getPanelStyle(3)} className="overflow-hidden">
          <PanelShell num="3" label={t.panel3} collapsed={collapsed[3]} onToggle={() => togglePanel(3)}>
            <DiagramPanel
              xml={xml}
              onXmlChange={setXml}
              bpmnLoading={bpmnParsing}
              processName={parsed?.process_name}
              parsed={parsed}
              processDescription={processDescription}
              onGetImprovements={handleGetImprovements}
              apiKey={apiKey}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[3]} bRef={pRefs[4]} disabled={collapsed[3] || collapsed[4]}
          aKey={3} bKey={4} {...handleProps} />

        {/* Panel 4 — Project */}
        <div ref={p4Ref} style={getPanelStyle(4)} className="overflow-hidden">
          <PanelShell num="4" label={t.panel4} collapsed={collapsed[4]} onToggle={() => togglePanel(4)}>
            <ImprovePanel
              parsed={parsed}
              apiKey={apiKey}
              improvements={improvements}
              onGetImprovements={handleGetImprovements}
              onAddImprovement={handleAddImprovement}
              onUpdateImprovement={handleUpdateImprovement}
              selectedIds={selectedImprovementIds}
              onToggleSelect={handleToggleSelect}
              customRisks={customRisks}
              onAddRisk={handleAddRisk}
              onUpdateRisk={handleUpdateRisk}
              onRemoveRisk={handleRemoveRisk}
              projectPlan={projectPlan}
              onGeneratePlan={handleGeneratePlan}
              planLoading={planLoading}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[4]} bRef={pRefs[5]} disabled={collapsed[4] || collapsed[5]}
          aKey={4} bKey={5} {...handleProps} />

        {/* Panel 5 — Launch */}
        <div ref={p5Ref} style={getPanelStyle(5)} className="overflow-hidden">
          <PanelShell num="5" label={t.panel5} collapsed={collapsed[5]} onToggle={() => togglePanel(5)}>
            <LaunchPanel
              projectPlan={projectPlan}
              parsed={parsed}
              processDescription={processDescription}
              improvements={improvements}
              selectedIds={selectedImprovementIds}
            />
          </PanelShell>
        </div>

      </div>

      <BurgerMenu
        open={showBurger}
        onClose={() => setShowBurger(false)}
        apiKey={apiKey}
        onApiKeyChange={key => { setApiKey(key); }}
        vimplToken={vimplToken}
        onLoginGoogle={loginWithGoogle}
        onLoginVimpl={loginWithVimpl}
        onLogout={logoutVimpl}
        parsed={parsed}
        processContext={processContext}
        customTaxonomyNodes={customTaxonomyNodes}
        onTaxonomyChange={setCustomTaxonomyNodes}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
