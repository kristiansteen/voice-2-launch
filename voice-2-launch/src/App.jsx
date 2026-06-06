import { useState, useRef, useEffect, useCallback } from 'react';
import HelpModal from './components/HelpModal.jsx';
import BurgerMenu from './components/BurgerMenu.jsx';
import { useLang } from './i18n/LangContext.jsx';
import VoicePanel from './components/VoicePanel.jsx';
import DescriptionPanel from './components/DescriptionPanel.jsx';
import DiagramPanel from './components/DiagramPanel.jsx';
import ImprovePanel from './components/ImprovePanel.jsx';
import LaunchPanel from './components/LaunchPanel.jsx';
import Dashboard from './components/Dashboard.jsx';
import LoginPage from './components/LoginPage.jsx';
import RegisterPage from './components/RegisterPage.jsx';
import {
  parseVoiceToDescription,
  parseToBpmn,
  getStructuredImprovements,
  generateProjectPlan,
  generateToBeBpmn,
  extractProcessMetrics,
  estimateToBeMetrics,
  checkContentSafety,
} from './services/anthropicService.js';
import { generateBpmnXml } from './services/xmlGenerator.js';
import { useAileanInterviewer } from './hooks/useAileanInterviewer.js';
import { fetchFlows, upsertFlow, deleteFlow as apiDeleteFlow } from './services/flowService.js';
import {
  DEMO_TRANSCRIPT, DEMO_PARSED, DEMO_XML, DEMO_DESCRIPTION,
  DEMO_IMPROVEMENTS, DEMO_SELECTED_IDS, DEMO_TO_BE_XML,
  DEMO_PROJECT_PLAN, DEMO_AS_IS_METRICS, DEMO_TO_BE_METRICS,
} from './data/demoFlow.js';
import {
  DA_DEMO_TRANSCRIPT, DA_DEMO_PARSED, DA_DEMO_XML, DA_DEMO_DESCRIPTION,
  DA_DEMO_IMPROVEMENTS, DA_DEMO_SELECTED_IDS, DA_DEMO_TO_BE_XML,
  DA_DEMO_PROJECT_PLAN, DA_DEMO_AS_IS_METRICS, DA_DEMO_TO_BE_METRICS,
} from './data/daDemoFlow.js';
import ResizeHandle from './components/ResizeHandle.jsx';

const BACKEND_URL = 'https://backend-eight-rho-46.vercel.app';

function PanelShell({ num, label, children }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 shrink-0">
        <span className="text-xs font-bold text-white bg-vimpl rounded px-1.5 py-0.5 leading-none">{num}</span>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {children}
      </div>
    </div>
  );
}

const FLOWS_KEY = 'voice2bpmn_flows';
const ACTIVE_KEY = 'voice2bpmn_active';
const PRICING_URL = 'https://ailean.dk/ailean-pricing';

function blankFlowState() {
  return {
    transcript: '',
    processDescription: null,
    parsed: null,
    xml: null,
    improvements: null,
    selectedImprovementIds: [],
    customRisks: [],
    projectPlan: null,
    processContext: { apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null },
    asIsXml: null,
    asIsParsed: null,
    toBeXml: null,
    toBeParsed: null,
    asIsMetrics: null,
    toBeMetrics: null,
    board_url: null,
    board_id: null,
  };
}

// Build a structured "Interviewer / SME" transcript from Ailean conversation turns.
function buildStructuredTranscript(turns, currentDraft) {
  const parts = turns.map(turn =>
    turn.type === 'ailean'
      ? `Interviewer: ${turn.text}`
      : `SME: ${turn.text}`
  );
  if (currentDraft?.trim()) {
    parts.push(`SME: ${currentDraft.trim()}`);
  }
  return parts.join('\n\n');
}

export default function App() {
  const { t, lang, setLang } = useLang();
  const [langConfirmed, setLangConfirmed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showBurger, setShowBurger] = useState(false);

  // ── vimpl login state ──────────────────────────────────────────────
  const [loggedOut, setLoggedOut] = useState(false);
  const [authView, setAuthView]   = useState(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('register') === '1') {
      window.history.replaceState(null, '', window.location.pathname);
      return 'register';
    }
    return 'login';
  }); // 'login' | 'register'
  // Token lives in React state only — never written to localStorage.
  // Session is restored from the httpOnly refreshToken cookie on mount.
  const [vimplToken, setVimplToken] = useState(null);
  // True while the initial auth check (cookie refresh or ?code= exchange) is in flight
  const [authLoading, setAuthLoading] = useState(true);

  // On mount: restore session from the httpOnly refreshToken cookie, or exchange a ?code= param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // Exchange one-time code for JWT (redirect from vimpl login)
      window.history.replaceState(null, '', window.location.pathname);
      fetch(`${BACKEND_URL}/api/v1/auth/exchange-code?code=${encodeURIComponent(code)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.token) setVimplToken(data.token); })
        .catch(() => {})
        .finally(() => setAuthLoading(false));
    } else {
      // Silent refresh — restore session from httpOnly refreshToken cookie
      fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.accessToken) setVimplToken(data.accessToken); })
        .catch(() => {})
        .finally(() => setAuthLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [vimplUser, setVimplUser] = useState(null);
  const [boardUrl, setBoardUrl] = useState(null);
  const [boardId, setBoardId] = useState(null);
  const [boardVersion, setBoardVersion] = useState(1);

  // Fetch vimpl user info — on login and whenever the tab regains focus
  // (so subscription upgrades made on the pricing page are picked up immediately)
  function refreshVimplUser(token) {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => {
      if (r.status === 401) { logoutVimpl(); return null; }
      return r.ok ? r.json() : null;
    }).then(data => {
      if (data?.user) setVimplUser(data.user);
    }).catch(() => {});
  }

  useEffect(() => {
    refreshVimplUser(vimplToken);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vimplToken]);

  useEffect(() => {
    function onFocus() { refreshVimplUser(vimplToken); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vimplToken]);

  function handleExported(exportedBoardId, url, isNewBoard) {
    setBoardUrl(url);
    setBoardId(exportedBoardId);
    const nextVersion = isNewBoard ? boardVersion + 1 : boardVersion;
    if (isNewBoard) setBoardVersion(nextVersion);
    if (currentFlowId) {
      setFlows(prev => {
        const updated = prev.map(f => {
          if (f.id !== currentFlowId) return f;
          const updatedFlow = { ...f, board_id: exportedBoardId, board_url: url, board_version: nextVersion, updated_at: new Date().toISOString() };
          if (vimplToken && !f._demo) upsertFlow(vimplToken, updatedFlow).catch(() => {});
          return updatedFlow;
        });
        try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
  }

  function getProxyAuth() {
    return vimplToken ? { token: vimplToken } : null;
  }

  const effectiveApiKey = import.meta.env.DEV ? (import.meta.env.VITE_ANTHROPIC_API_KEY || null) : null;
  const hasAccess = !!vimplToken;

  // ── Multi-flow state ───────────────────────────────────────────────
  const [flows, setFlows] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FLOWS_KEY) || '[]');
      // Repair any flows that lost their id (race condition during first save)
      return stored.map(f => f.id ? f : { ...f, id: crypto.randomUUID() });
    }
    catch { return []; }
  });
  const [currentFlowId, setCurrentFlowId] = useState(() => {
    return localStorage.getItem(ACTIVE_KEY) || null;
  });
  const [flowsLoading, setFlowsLoading] = useState(false);

  // ── Load flows from API on login ───────────────────────────────────
  useEffect(() => {
    if (!vimplToken) return;
    setFlowsLoading(true);
    fetchFlows(vimplToken).then(apiFlows => {
      const remoteFlows = apiFlows.map(f => ({ ...f.data, id: f.id, updated_at: f.updatedAt, created_at: f.createdAt || f.data?.created_at }));
      setFlows(prev => {
        const prevMap = new Map(prev.map(f => [f.id, f]));
        // Prefer whichever version is newer — guards against server lag overwriting unsaved local work
        const mergedRemote = remoteFlows.map(remote => {
          const local = prevMap.get(remote.id);
          if (local?.updated_at && remote.updated_at && local.updated_at > remote.updated_at) return local;
          return remote;
        });
        const remoteIds = new Set(remoteFlows.map(f => f.id));
        const localOnly = prev.filter(f => !remoteIds.has(f.id) && !f._demo);
        const merged = [...mergedRemote, ...localOnly];
        try { localStorage.setItem(FLOWS_KEY, JSON.stringify(merged)); } catch {}
        return merged;
      });
    }).catch(() => {}).finally(() => setFlowsLoading(false));
  }, [vimplToken]); // eslint-disable-line

  const isSubscribed = vimplUser && (vimplUser.subscriptionTier === 'commercial' || vimplUser.subscriptionTier === 'enterprise');
  const canCreateFlow = isSubscribed || flows.filter(f => !f._demo).length === 0;

  // True when the currently-open flow is a demo flow (never consumes trial quota)
  const currentFlow = flows.find(f => f.id === currentFlowId);
  const isDemoFlow = !!(currentFlow?._demo);

  // ── Carousel state ─────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState(1);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function getCarouselStyle(n) {
    const offset = n - activePanel;
    const base = {
      position: 'absolute',
      top: 0,
      bottom: 0,
      transition: 'left 0.38s cubic-bezier(0.4,0,0.2,1), width 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.3s, box-shadow 0.38s, border-radius 0.38s',
      overflow: 'hidden',
    };

    // Mobile — full-width single panel, swipe left/right off-screen
    if (isMobile) {
      if (offset === 0) return { ...base, left: '0%', width: '100%', opacity: 1, zIndex: 10, borderRadius: 0 };
      return { ...base, left: offset < 0 ? '-100%' : '100%', width: '100%', opacity: 0, zIndex: 0, pointerEvents: 'none', borderRadius: 0 };
    }

    const r = '8px'; // standard radius from CSS design system

    // Panel 3 (Map) — full width, no peeking, no radius (edge-to-edge)
    if (activePanel === 3) {
      if (offset === 0)  return { ...base, left: '0%',   width: '100%', opacity: 1, zIndex: 10, boxShadow: 'none', borderRadius: 0 };
      return { ...base, left: offset < 0 ? '-100%' : '100%', width: '100%', opacity: 0, zIndex: 0, pointerEvents: 'none', borderRadius: 0 };
    }

    // Panels 2, 4 & 5 (Identify / Plan / Launch) — 50% centred, neighbours peek on both sides
    if (activePanel === 2 || activePanel === 4 || activePanel === 5) {
      if (offset === 0)  return { ...base, left: '25%', width: '50%', opacity: 1,    zIndex: 10, boxShadow: '0 8px 48px rgba(0,0,0,0.22)', borderRadius: r };
      if (offset === -1) return { ...base, left: '0%',  width: '23%', opacity: 0.45, zIndex: 5,  cursor: 'pointer', borderRadius: r };
      if (offset === 1)  return { ...base, left: '77%', width: '23%', opacity: 0.45, zIndex: 5,  cursor: 'pointer', borderRadius: r };
      return { ...base, left: offset < 0 ? '-20%' : '100%', width: '18%', opacity: 0, zIndex: 0, pointerEvents: 'none', borderRadius: r };
    }

    // Panels 1 & 2 — 30% flush-left, next panel fills the right
    if (offset === 0)  return { ...base, left: '0%',  width: '30%', opacity: 1,    zIndex: 10, boxShadow: '0 8px 48px rgba(0,0,0,0.22)', borderRadius: r };
    if (offset === 1)  return { ...base, left: '31%', width: '60%', opacity: 0.55, zIndex: 5,  cursor: 'pointer', borderRadius: r };
    if (offset === 2)  return { ...base, left: '92%', width: '7%',  opacity: 0.3,  zIndex: 3,  cursor: 'pointer', borderRadius: r };
    return { ...base, left: offset < 0 ? '-20%' : '100%', width: '18%', opacity: 0, zIndex: 0, pointerEvents: 'none', borderRadius: r };
  }

  // Process context
  const [processContext, setProcessContext] = useState({
    apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null,
  });

  function handleProcessContextChange(newCtx) {
    setProcessContext(newCtx);
    // If BPMN already exists, update process_name in-place — no re-approval needed
    if (parsed && !isDemoFlow) {
      const newName = !newCtx.isCustom && newCtx.apqcNodeName && newCtx.apqcNodeLevel === 3
        ? newCtx.apqcNodeName
        : newCtx.isCustom && newCtx.customLabel
          ? newCtx.customLabel
          : null;
      if (newName) {
        const updatedParsed = { ...parsed, process_name: newName };
        setParsed(updatedParsed);
        generateBpmnXml(updatedParsed).then(setXml);
      }
    }
  }

  // Panel 1 — Voice
  const apiSaveTimer = useRef(null);
  const saveStatusTimer = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [transcript, setTranscript] = useState('');
  const [descParsing, setDescParsing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  // ── Ailean AI Interviewer ──────────────────────────────────────────
  const ailean = useAileanInterviewer(lang);

  // Panel 2 — Description
  const [processDescription, setProcessDescription] = useState(null);
  const [bpmnParsing, setBpmnParsing] = useState(false);
  const [showExtendedTokensPrompt, setShowExtendedTokensPrompt] = useState(false);

  // Panel 3 — Diagram (parsed BPMN JSON + XML)
  const [parsed, setParsed] = useState(null);
  const [xml, setXml] = useState(null);

  // Panel 4 — Plan
  const [improvements, setImprovements] = useState(null);
  const [selectedImprovementIds, setSelectedImprovementIds] = useState([]);
  const [customRisks, setCustomRisks] = useState([]);
  const [projectPlan, setProjectPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Plan generation prompt modal
  const [showPlanPrompt, setShowPlanPrompt] = useState(false);
  const [planStartDate, setPlanStartDate] = useState('');
  const [planDurationWeeks, setPlanDurationWeeks] = useState(14);

  // Panel 3 — AS-IS / TO-BE
  const [asIsXml, setAsIsXml] = useState(null);
  const [asIsParsed, setAsIsParsed] = useState(null);
  const [toBeXml, setToBeXml] = useState(null);
  const [toBeParsed, setToBeParsed] = useState(null);
  const [toBeLoading, setToBeLoading] = useState(false);
  const [toBeApproved, setToBeApproved] = useState(false);

  // Process metrics (activities: duration + backlog; gateways: branch rates)
  const [asIsMetrics, setAsIsMetrics] = useState(null);
  const [toBeMetrics, setToBeMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  function loginWithGoogle() {
    // Backend decodes state as plain base64 URL, then redirects to ${state}/callback.html?token=...
    const state = btoa(window.location.origin);
    window.location.href = `${BACKEND_URL}/api/v1/auth/google?state=${encodeURIComponent(state)}`;
  }

  function loginWithVimpl() {
    const returnTo = window.location.href.split('?')[0];
    window.location.href = `${VIMPL_LOGIN_URL}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function logoutVimpl() {
    // Flush any pending autosave to the server before the token is cleared
    clearTimeout(apiSaveTimer.current);
    const activeFlow = flows.find(f => f.id === currentFlowId);
    if (vimplToken && activeFlow && !activeFlow._demo) {
      const hasContent = transcript || processDescription || parsed || xml || improvements || projectPlan;
      if (hasContent) {
        const flushed = {
          ...activeFlow,
          transcript, processDescription, parsed, xml,
          improvements, selectedImprovementIds, customRisks, projectPlan, processContext,
          asIsXml, asIsParsed, toBeXml, toBeParsed, asIsMetrics, toBeMetrics,
          updated_at: new Date().toISOString(),
        };
        upsertFlow(vimplToken, flushed).catch(() => {});
      }
    }
    fetch(`${BACKEND_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setVimplToken(null);
    setLoggedOut(true);
  }

  // ── Migrate old single-draft format to multi-flow on first run ────
  useEffect(() => {
    try {
      const oldDraft = localStorage.getItem('voice2bpmn_draft');
      const existingFlows = JSON.parse(localStorage.getItem(FLOWS_KEY) || '[]');
      if (oldDraft && existingFlows.length === 0) {
        const draft = JSON.parse(oldDraft);
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const migrated = {
          id,
          process_name: draft.parsed?.process_name || draft.processDescription?.process_name || 'Migrated flow',
          created_at: now,
          updated_at: now,
          board_url: null,
          board_id: null,
          ...draft,
        };
        const newFlows = [migrated];
        localStorage.setItem(FLOWS_KEY, JSON.stringify(newFlows));
        localStorage.removeItem('voice2bpmn_draft');
        setFlows(newFlows);
        if (draft.transcript || draft.parsed) {
          loadFlowIntoState(migrated);
          setCurrentFlowId(id);
          localStorage.setItem(ACTIVE_KEY, id);
        }
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore active flow on mount ───────────────────────────────────
  useEffect(() => {
    if (!currentFlowId) return;
    const stored = JSON.parse(localStorage.getItem(FLOWS_KEY) || '[]');
    const flow = stored.find(f => f.id === currentFlowId);
    if (flow) loadFlowIntoState(flow);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadFlowIntoState(flow) {
    setTranscript(flow.transcript || '');
    setProcessDescription(flow.processDescription || null);
    setParsed(flow.parsed || null);
    setXml(flow.xml || null);
    setImprovements(flow.improvements || null);
    setSelectedImprovementIds(flow.selectedImprovementIds || []);
    setCustomRisks(flow.customRisks || []);
    setProjectPlan(flow.projectPlan || null);
    setProcessContext(flow.processContext || { apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
    setAsIsXml(flow.asIsXml || null);
    setAsIsParsed(flow.asIsParsed || null);
    setToBeXml(flow.toBeXml || null);
    setToBeParsed(flow.toBeParsed || null);
    setAsIsMetrics(flow.asIsMetrics || null);
    setToBeMetrics(flow.toBeMetrics || null);
    setBoardUrl(flow.board_url || null);
    setBoardId(flow.board_id || null);
    setBoardVersion(flow.board_version || 1);
  }

  // ── Auto-save current flow whenever key state changes ─────────────
  useEffect(() => {
    if (!currentFlowId) return;
    const hasContent = transcript || processDescription || parsed || xml || improvements || projectPlan || asIsXml || toBeXml;
    if (!hasContent) return;
    const base = flows.find(f => f.id === currentFlowId) || {};
    const updatedFlow = {
      ...base,
      id: currentFlowId,
      process_name: parsed?.process_name || processDescription?.process_name || base.process_name,
      updated_at: new Date().toISOString(),
      transcript, processDescription, parsed, xml,
      improvements, selectedImprovementIds, customRisks, projectPlan, processContext,
      asIsXml, asIsParsed, toBeXml, toBeParsed, asIsMetrics, toBeMetrics,
    };
    setFlows(prev => {
      const updated = prev.map(f => f.id === currentFlowId ? updatedFlow : f);
      try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
    // Debounced API sync (skip demo flows)
    if (vimplToken && !base._demo) {
      clearTimeout(apiSaveTimer.current);
      clearTimeout(saveStatusTimer.current);
      setSaveStatus('saving');
      apiSaveTimer.current = setTimeout(() => {
        upsertFlow(vimplToken, updatedFlow)
          .then(() => {
            setSaveStatus('saved');
            saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 3000);
          })
          .catch((err) => {
            if (err.status === 403) {
              // Flow ID in localStorage belongs to a different account (e.g. after account reset).
              // Reassign a fresh UUID for this user and retry once.
              const newId = crypto.randomUUID();
              const reflowed = { ...updatedFlow, id: newId };
              setCurrentFlowId(newId);
              localStorage.setItem(ACTIVE_KEY, newId);
              setFlows(prev => {
                const updated = prev.map(f => f.id === updatedFlow.id ? reflowed : f);
                try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
                return updated;
              });
              upsertFlow(vimplToken, reflowed)
                .then(() => {
                  setSaveStatus('saved');
                  saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 3000);
                })
                .catch(() => setSaveStatus('error'));
            } else {
              setSaveStatus('error');
            }
          });
      }, 2000);
    }
  }, [currentFlowId, transcript, processDescription, parsed, xml, improvements, selectedImprovementIds, customRisks, projectPlan, processContext, asIsXml, asIsParsed, toBeXml, toBeParsed, asIsMetrics, toBeMetrics]); // eslint-disable-line

  // ── Flow navigation ────────────────────────────────────────────────
  function handleConfirmLang() {
    setLang(lang);
    setLangConfirmed(true);
  }

  function handleOpenFlow(flowId) {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) return;
    loadFlowIntoState(flow);
    setCurrentFlowId(flowId);
    setLangConfirmed(false);
    localStorage.setItem(ACTIVE_KEY, flowId);
  }

  async function handleCreateFlow() {
    if (!canCreateFlow) {
      window.open(PRICING_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newFlow = {
      id,
      process_name: 'New process',
      created_at: now,
      updated_at: now,
      board_id: null,
      board_url: null,
      ...blankFlowState(),
    };
    setFlows(prev => {
      const updated = [newFlow, ...prev];
      try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (vimplToken) upsertFlow(vimplToken, newFlow).catch(() => {});
    // Reset all content state
    setTranscript('');
    setProcessDescription(null);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setCustomRisks([]);
    setProjectPlan(null);
    setAsIsXml(null);
    setAsIsParsed(null);
    setToBeXml(null);
    setToBeParsed(null);
    setAsIsMetrics(null);
    setToBeMetrics(null);
    setProcessContext({ apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
    setBoardUrl(null);
    setBoardId(null);
    setCurrentFlowId(id);
    setLangConfirmed(false);
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function handleBackToDashboard() {
    setCurrentFlowId(null);
    localStorage.removeItem(ACTIVE_KEY);
  }

  function handleClearCurrentFlow() {
    setTranscript('');
    setProcessDescription(null);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setCustomRisks([]);
    setProjectPlan(null);
    setAsIsXml(null);
    setAsIsParsed(null);
    setToBeXml(null);
    setToBeParsed(null);
    setAsIsMetrics(null);
    setToBeMetrics(null);
    setProcessContext({ apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
    setBoardUrl(null);
    setBoardId(null);
    if (currentFlowId) {
      setFlows(prev => {
        const updated = prev.map(f => f.id === currentFlowId
          ? { ...f, ...blankFlowState(), process_name: 'New process', updated_at: new Date().toISOString() }
          : f
        );
        try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
  }

  function handleUpdateFlowRag(flowId, ragStatus) {
    setFlows(prev => {
      const updated = prev.map(f => {
        if (f.id !== flowId) return f;
        const updatedFlow = { ...f, ragStatus };
        if (vimplToken && !f._demo) upsertFlow(vimplToken, updatedFlow).catch(() => {});
        return updatedFlow;
      });
      try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  async function handleDeleteFlow(flowId, deleteBoard) {
    const flow = flows.find(f => f.id === flowId);
    if (deleteBoard && flow?.board_id && vimplToken) {
      await fetch(`${BACKEND_URL}/api/v1/boards/${flow.board_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${vimplToken}` },
      }).catch(() => {});
    }
    if (vimplToken && !flow?._demo) apiDeleteFlow(vimplToken, flowId).catch(() => {});
    setFlows(prev => {
      const updated = prev.filter(f => f.id !== flowId);
      try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (currentFlowId === flowId) {
      setCurrentFlowId(null);
      localStorage.removeItem(ACTIVE_KEY);
    }
  }

  function handleToggleDemo() {
    if (isDemoFlow) {
      // Deactivate: remove the demo flow and start a blank new one
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const newFlow = { id, process_name: 'New process', created_at: now, updated_at: now, ...blankFlowState() };
      setFlows(prev => {
        const updated = [newFlow, ...prev.filter(f => !f._demo)];
        try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
      setTranscript(''); setProcessDescription(null); setParsed(null); setXml(null);
      setImprovements(null); setSelectedImprovementIds([]); setCustomRisks([]);
      setProjectPlan(null); setAsIsXml(null); setAsIsParsed(null);
      setToBeXml(null); setToBeParsed(null); setAsIsMetrics(null); setToBeMetrics(null);
      setProcessContext({ apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
      setBoardUrl(null); setBoardId(null);
      setActivePanel(1);
      setCurrentFlowId(id);
      setLangConfirmed(false);
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      handleLoadDemo();
    }
  }

  function handleLoadDemo() {
    const isDa = lang === 'da';
    const demoTranscript = isDa ? DA_DEMO_TRANSCRIPT : DEMO_TRANSCRIPT;
    const demoContext = isDa
      ? { apqcNodeId: '8.6', apqcNodeName: 'Behandling af kreditorfakturaer', isCustom: false, customLabel: null }
      : { apqcNodeId: '8.6', apqcNodeName: 'Process accounts payable and expense reimbursements', isCustom: false, customLabel: null };
    const demoName = isDa ? 'Kreditorfakturaer (Demo)' : 'AP Invoice Processing (Demo)';

    const flowId = crypto.randomUUID();
    const now = new Date().toISOString();
    const demoFlow = {
      id: flowId,
      process_name: demoName,
      created_at: now,
      updated_at: now,
      _demo: true,
      ...blankFlowState(),
      transcript: demoTranscript,
      processContext: demoContext,
    };

    // Remove any previous demo flows and add the fresh one
    setFlows(prev => {
      const withoutDemo = prev.filter(f => !f._demo);
      const updated = [demoFlow, ...withoutDemo];
      try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Reset all state to blank, load only the transcript
    setTranscript(demoTranscript);
    setProcessDescription(null);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setCustomRisks([]);
    setProjectPlan(null);
    setAsIsXml(null);
    setAsIsParsed(null);
    setToBeXml(null);
    setToBeParsed(null);
    setAsIsMetrics(null);
    setToBeMetrics(null);
    setProcessContext(demoContext);
    setBoardUrl(null);
    setBoardId(null);
    setVoiceError(null);
    setActivePanel(1);

    setCurrentFlowId(flowId);
    setLangConfirmed(false);
    localStorage.setItem(ACTIVE_KEY, flowId);
  }

  // If Ailean interviewed, build a structured transcript; otherwise use raw text.
  function getEffectiveTranscript() {
    if (ailean.turns.length > 0) {
      return buildStructuredTranscript(ailean.turns, '');
    }
    return transcript;
  }

  async function handleParseVoice() {
    if (isDemoFlow) {
      const isDa = lang === 'da';
      setProcessDescription(isDa ? DA_DEMO_DESCRIPTION : DEMO_DESCRIPTION);
      setActivePanel(2);
      return;
    }
    setDescParsing(true);
    setVoiceError(null);
    setProcessDescription(null);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setProjectPlan(null);
    try {
      // ── Pre-flight safety check ──────────────────────────────────────────
      const safety = await checkContentSafety(getEffectiveTranscript(), effectiveApiKey, getProxyAuth());
      if (!safety.safe) {
        setVoiceError(`Content flagged: ${safety.reason || 'The transcript contains content that cannot be processed.'}`);
        return;
      }
      const desc = await parseVoiceToDescription(getEffectiveTranscript(), effectiveApiKey, processContext, getProxyAuth(), lang);
      setProcessDescription(desc);
      setActivePanel(2);
    } catch (err) {
      setVoiceError(err.message || 'Failed to parse voice.');
    } finally {
      setDescParsing(false);
    }
  }

  async function handleApproveToBpmn(useExtendedTokens = false) {
    if (isDemoFlow) {
      const isDa = lang === 'da';
      const demoParsed = isDa ? DA_DEMO_PARSED : DEMO_PARSED;
      const demoXml = isDa ? DA_DEMO_XML : DEMO_XML;
      setParsed(demoParsed);
      setXml(demoXml);
      setAsIsXml(demoXml);
      setAsIsParsed(demoParsed);
      setAsIsMetrics(isDa ? DA_DEMO_AS_IS_METRICS : DEMO_AS_IS_METRICS);
      setActivePanel(3);
      return;
    }

    // If the description is large, warn before proceeding with standard 4 000-token limit
    const descSize = JSON.stringify(processDescription).length;
    if (!useExtendedTokens && descSize > 8000) {
      setShowExtendedTokensPrompt(true);
      return;
    }

    setBpmnParsing(true);
    setShowExtendedTokensPrompt(false);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setProjectPlan(null);
    setAsIsMetrics(null);
    setToBeMetrics(null);
    try {
      const maxTokens = useExtendedTokens ? 8000 : 4000;
      const bpmnJson = await parseToBpmn(processDescription, effectiveApiKey, processContext, getProxyAuth(), lang, maxTokens);
      setParsed(bpmnJson);
      const generatedXml = await generateBpmnXml(bpmnJson);
      setXml(generatedXml);
      setActivePanel(3);
      // Background: extract AS-IS metrics from transcript
      const _transcript = getEffectiveTranscript();
      const _apiKey = effectiveApiKey;
      const _proxyAuth = getProxyAuth();
      setMetricsLoading(true);
      extractProcessMetrics(bpmnJson, _transcript, _apiKey, _proxyAuth, lang)
        .then(m => { if (m) setAsIsMetrics(m); })
        .catch(() => {})
        .finally(() => setMetricsLoading(false));
    } finally {
      setBpmnParsing(false);
    }
  }

  async function handleGetImprovements() {
    if (isDemoFlow) {
      const isDa = lang === 'da';
      setImprovements(isDa ? DA_DEMO_IMPROVEMENTS : DEMO_IMPROVEMENTS);
      setSelectedImprovementIds(isDa ? DA_DEMO_SELECTED_IDS : DEMO_SELECTED_IDS);
      setActivePanel(4);
      return;
    }
    const result = await getStructuredImprovements(parsed, effectiveApiKey, getProxyAuth(), lang);
    setImprovements(result);
    setSelectedImprovementIds([]);
    setActivePanel(4);
  }

  function handleAddImprovement(idea) {
    setImprovements(prev => [...(prev || []), idea]);
    setSelectedImprovementIds(prev => [...prev, idea.id]);
  }

  function handleUpdateImprovement(updated) {
    setImprovements(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  function handleDeleteImprovement(id) {
    setImprovements(prev => prev.filter(i => i.id !== id));
    setSelectedImprovementIds(prev => prev.filter(sid => sid !== id));
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
    setToBeApproved(false);
  }

  function handleGeneratePlanClick() {
    if (isDemoFlow) {
      const isDa = lang === 'da';
      setAsIsXml(isDa ? DA_DEMO_XML : DEMO_XML);
      setAsIsParsed(isDa ? DA_DEMO_PARSED : DEMO_PARSED);
      setProjectPlan(isDa ? DA_DEMO_PROJECT_PLAN : DEMO_PROJECT_PLAN);
      setToBeXml(isDa ? DA_DEMO_TO_BE_XML : DEMO_TO_BE_XML);
      setAsIsMetrics(isDa ? DA_DEMO_AS_IS_METRICS : DEMO_AS_IS_METRICS);
      setToBeMetrics(isDa ? DA_DEMO_TO_BE_METRICS : DEMO_TO_BE_METRICS);
      setActivePanel(5);
      return;
    }
    const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
    if (!selected.length) return;
    // Pre-fill start date to today
    setPlanStartDate(new Date().toISOString().slice(0, 10));
    setPlanDurationWeeks(14);
    setShowPlanPrompt(true);
  }

  async function handleGenerateToBe() {
    const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
    if (!selected.length) return;

    if (isDemoFlow) {
      const isDa = lang === 'da';
      setAsIsXml(isDa ? DA_DEMO_XML : DEMO_XML);
      setAsIsParsed(isDa ? DA_DEMO_PARSED : DEMO_PARSED);
      setToBeXml(isDa ? DA_DEMO_TO_BE_XML : DEMO_TO_BE_XML);
      setToBeParsed(null);
      setToBeMetrics(isDa ? DA_DEMO_TO_BE_METRICS : DEMO_TO_BE_METRICS);
      setToBeApproved(false);
      return;
    }

    // Freeze AS-IS snapshot
    setAsIsXml(xml);
    setAsIsParsed(parsed);
    setToBeXml(null);
    setToBeParsed(null);
    setToBeApproved(false);
    setToBeLoading(true);

    try {
      const toBeParsedResult = await generateToBeBpmn(parsed, selected, effectiveApiKey, getProxyAuth(), lang);
      setToBeParsed(toBeParsedResult);
      const { generateBpmnXml: genXml } = await import('./services/xmlGenerator.js');
      setToBeXml(await genXml(toBeParsedResult));
      // Background: estimate TO-BE metrics
      const _asIsMetrics = asIsMetrics;
      estimateToBeMetrics(parsed, toBeParsedResult, _asIsMetrics, selected, effectiveApiKey, getProxyAuth(), lang)
        .then(m => { if (m) setToBeMetrics(m); })
        .catch(() => {});
    } finally {
      setToBeLoading(false);
    }
  }

  async function handleGeneratePlan() {
    setShowPlanPrompt(false);
    const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
    if (!selected.length) return;

    setPlanLoading(true);
    try {
      const plan = await generateProjectPlan(parsed, selected, effectiveApiKey, customRisks, getProxyAuth(), planStartDate || null, planDurationWeeks, lang);
      setProjectPlan({ ...plan, _startDate: planStartDate || null });
      setActivePanel(5);
    } finally {
      setPlanLoading(false);
    }
  }


  // ── handleLogin — called by LoginPage / RegisterPage ────────────────
  function handleLogin(accessToken) {
    setVimplToken(accessToken);
    setLoggedOut(false);
  }

  // ── Login gate ────────────────────────────────────────────────────
  if (!vimplToken) {
    if (authLoading) return null;
    if (authView === 'register') {
      return <RegisterPage onLogin={handleLogin} onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onLogin={handleLogin} onSwitchToRegister={() => setAuthView('register')} />;
  }

  // ── Dashboard ──────────────────────────────────────────────────────
  if (!currentFlowId) {
    return (
      <>
        <Dashboard
          flows={flows}
          loading={flowsLoading}
          vimplUser={vimplUser}
          onOpen={handleOpenFlow}
          onCreate={handleCreateFlow}
          onDelete={handleDeleteFlow}
          onUpdateRag={handleUpdateFlowRag}
          canCreate={canCreateFlow}
          onLogout={logoutVimpl}
          onDemo={handleLoadDemo}
          onBurger={() => setShowBurger(true)}
        />
        <BurgerMenu
          open={showBurger}
          onClose={() => setShowBurger(false)}
          vimplToken={vimplToken}
          vimplUser={vimplUser}
          onLogout={logoutVimpl}
          onNewFlow={handleCreateFlow}
          onOverview={handleBackToDashboard}
          currentFlowId={currentFlowId}
          flowName={currentFlow?.process_name || currentFlow?.name}
        />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
      {/* Header */}
      <header className="relative flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="ailean-logo" style={{ fontSize: '15px' }}>AILEAN</span>
        </div>
        {/* Save status — left side */}
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin shrink-0" />
              Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <button
              onClick={() => { setSaveStatus('idle'); upsertFlow(vimplToken, flows.find(f => f.id === currentFlowId)).catch(() => setSaveStatus('error')); }}
              className="text-xs text-red-500 hover:text-red-700 underline"
              title="Click to retry"
            >
              Save failed — retry
            </button>
          )}
        </div>

        {/* Burger — right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBurger(true)}
            className="flex flex-col gap-1 items-center justify-center w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 hover:bg-gray-200 hover:border-vimpl-light transition-colors"
            title="Settings"
          >
            <span className="w-4 h-0.5 bg-gray-500 rounded" />
            <span className="w-4 h-0.5 bg-gray-500 rounded" />
            <span className="w-4 h-0.5 bg-gray-500 rounded" />
          </button>
        </div>
      </header>

      {/* Step navigator */}
      {(() => {
        const steps = [
          { num: 1, label: t.panel1 },
          { num: 2, label: t.panel2 },
          { num: 3, label: t.panel3 },
          { num: 4, label: t.panel4 },
          { num: 5, label: t.panel5 },
        ];
        return (
          <div className="relative flex items-center justify-center gap-1 px-4 py-2 bg-slate-100 border-b border-gray-200 shrink-0">
            {/* Left: utility buttons — pinned to left edge */}
            <div className="absolute left-2 flex items-center gap-1.5">
              <button
                onClick={handleToggleDemo}
                className={[
                  'text-xs font-medium rounded-md px-2 py-1 border transition-colors',
                  isDemoFlow
                    ? 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-50 hover:text-blue-500'
                    : 'text-gray-500 bg-white hover:text-blue-600 hover:border-blue-300 border-gray-300 border-dashed',
                ].join(' ')}
                title={isDemoFlow ? 'Exit demo mode' : t.loadDemoTitle}
              >
                {isMobile ? (isDemoFlow ? '●' : 'Demo') : (isDemoFlow ? t.demoMode : t.tryDemo)}
              </button>
              {!isMobile && (transcript || xml) && (
                <button
                  onClick={handleClearCurrentFlow}
                  className="text-xs text-gray-400 hover:text-red-400 border border-gray-200 rounded-md px-2 py-1 transition-colors"
                  title={t.clearTitle}
                >
                  {t.clear}
                </button>
              )}
            </div>
            <button
              onClick={() => setActivePanel(p => Math.max(1, p - 1))}
              disabled={activePanel === 1}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors px-2 text-sm select-none"
            >
              ←
            </button>
            {steps.map(s => (
              <button
                key={s.num}
                onClick={() => setActivePanel(s.num)}
                className={[
                  'flex items-center gap-1.5 rounded-full text-xs font-medium transition-all',
                  isMobile ? 'px-2 py-1' : 'px-3 py-1',
                  activePanel === s.num
                    ? 'bg-vimpl text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200',
                ].join(' ')}
              >
                <span className={[
                  'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                  activePanel === s.num ? 'bg-white/50 text-gray-800' : 'bg-gray-300 text-gray-500',
                ].join(' ')}>{s.num}</span>
                {!isMobile && s.label}
              </button>
            ))}
            <button
              onClick={() => setActivePanel(p => Math.min(5, p + 1))}
              disabled={activePanel === 5}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors px-2 text-sm select-none"
            >
              →
            </button>
          </div>
        );
      })()}

      {/* Carousel */}
      <div className="relative flex-1 bg-slate-100 overflow-hidden">

        {/* Panel 1 — Voice */}
        <div style={getCarouselStyle(1)} onClick={activePanel !== 1 ? () => setActivePanel(1) : undefined}>
          <PanelShell num="1" label={t.panel1}>
            {voiceError && (
              <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-xs shrink-0">
                {voiceError}
              </div>
            )}
            <VoicePanel
              transcript={transcript}
              setTranscript={setTranscript}
              effectiveTranscript={getEffectiveTranscript()}
              onParse={handleParseVoice}
              loading={descParsing}
              canParse={!!getEffectiveTranscript().trim() && (hasAccess || isDemoFlow)}
              ailean={ailean}
              hasElevenLabsKey={!!vimplToken}
              langConfirmed={langConfirmed}
              onConfirmLang={handleConfirmLang}
            />
          </PanelShell>
          {activePanel !== 1 && <div className="absolute inset-0 bg-slate-100/20 pointer-events-none" />}
        </div>

        {/* Panel 2 — Description */}
        <div style={getCarouselStyle(2)} onClick={activePanel !== 2 ? () => setActivePanel(2) : undefined}>
          <PanelShell num="2" label={t.panel2}>
            {showExtendedTokensPrompt && (
              <div className="absolute inset-x-0 top-0 z-20 mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
                <p className="text-sm font-medium text-amber-900 mb-1">Large process detected</p>
                <p className="text-xs text-amber-700 mb-3">
                  This process description exceeds the standard 4 000-token limit and may be truncated,
                  causing the BPMN generation to fail. Would you like to continue with an extended
                  8 000-token limit instead?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveToBpmn(true)}
                    className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    Use extended limit (8 000 tokens)
                  </button>
                  <button
                    onClick={() => handleApproveToBpmn(false)}
                    className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    Continue with standard (4 000)
                  </button>
                  <button
                    onClick={() => setShowExtendedTokensPrompt(false)}
                    className="px-3 text-xs text-amber-400 hover:text-amber-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <DescriptionPanel
              description={processDescription}
              onDescriptionChange={setProcessDescription}
              onApprove={handleApproveToBpmn}
              loading={descParsing}
              canApprove={!!processDescription && (hasAccess || isDemoFlow) && !bpmnParsing}
              processContext={processContext}
              onProcessContextChange={handleProcessContextChange}
            />
          </PanelShell>
          {activePanel !== 2 && <div className="absolute inset-0 bg-slate-100/20 pointer-events-none" />}
        </div>

        {/* Panel 3 — Diagram */}
        <div style={getCarouselStyle(3)} onClick={activePanel !== 3 ? () => setActivePanel(3) : undefined}>
          <PanelShell num="3" label={t.panel3}>
            <DiagramPanel
              xml={xml}
              onXmlChange={setXml}
              bpmnLoading={bpmnParsing}
              processName={parsed?.process_name}
              parsed={parsed}
              toBeParsed={toBeParsed}
              processDescription={processDescription}
              onGetImprovements={handleGetImprovements}
              apiKey={hasAccess ? (effectiveApiKey || 'granted') : (isDemoFlow ? 'demo' : null)}
              asIsXml={asIsXml}
              toBeXml={toBeXml}
              onToBeXmlChange={setToBeXml}
              toBeLoading={toBeLoading}
              asIsMetrics={asIsMetrics}
              onAsIsMetricsChange={setAsIsMetrics}
              toBeMetrics={toBeMetrics}
              onToBeMetricsChange={setToBeMetrics}
              metricsLoading={metricsLoading}
              onExtractMetrics={() => {
                if (!parsed) return;
                setMetricsLoading(true);
                extractProcessMetrics(parsed, getEffectiveTranscript(), effectiveApiKey, getProxyAuth(), lang)
                  .then(m => { if (m) setAsIsMetrics(m); })
                  .catch(() => {})
                  .finally(() => setMetricsLoading(false));
              }}
              onEstimateToBeMetrics={() => {
                if (!parsed || !toBeParsed) return;
                const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
                estimateToBeMetrics(parsed, toBeParsed, asIsMetrics, selected, effectiveApiKey, getProxyAuth(), lang)
                  .then(m => { if (m) setToBeMetrics(m); })
                  .catch(() => {});
              }}
            />
          </PanelShell>
          {activePanel !== 3 && <div className="absolute inset-0 bg-slate-100/20 pointer-events-none" />}
        </div>

        {/* Panel 4 — Plan */}
        <div style={getCarouselStyle(4)} onClick={activePanel !== 4 ? () => setActivePanel(4) : undefined}>
          <PanelShell num="4" label={t.panel4}>
            <ImprovePanel
              parsed={parsed}
              apiKey={hasAccess ? (effectiveApiKey || 'granted') : (isDemoFlow ? 'demo' : null)}
              improvements={improvements}
              onGetImprovements={handleGetImprovements}
              onAddImprovement={handleAddImprovement}
              onUpdateImprovement={handleUpdateImprovement}
              onDeleteImprovement={handleDeleteImprovement}
              selectedIds={selectedImprovementIds}
              onToggleSelect={handleToggleSelect}
              toBeXml={toBeXml}
              toBeLoading={toBeLoading}
              onGenerateToBe={handleGenerateToBe}
              toBeApproved={toBeApproved}
              onApproveToBe={() => setToBeApproved(true)}
              onReviewDiagram={() => setActivePanel(3)}
              projectPlan={projectPlan}
              onGeneratePlan={handleGeneratePlanClick}
              planLoading={planLoading}
            />
          </PanelShell>
          {activePanel !== 4 && <div className="absolute inset-0 bg-slate-100/20 pointer-events-none" />}
        </div>

        {/* Panel 5 — Launch */}
        <div style={getCarouselStyle(5)} onClick={activePanel !== 5 ? () => setActivePanel(5) : undefined}>
          <PanelShell num="5" label={t.panel5}>
            <LaunchPanel
              projectPlan={projectPlan}
              parsed={parsed}
              processDescription={processDescription}
              improvements={improvements}
              selectedIds={selectedImprovementIds}
              customRisks={customRisks}
              onAddRisk={handleAddRisk}
              onUpdateRisk={handleUpdateRisk}
              onRemoveRisk={handleRemoveRisk}
              onExported={handleExported}
              vimplToken={vimplToken}
              boardUrl={boardUrl}
              boardId={boardId}
              boardVersion={boardVersion}
              onNewFlow={handleCreateFlow}
              isDemoFlow={isDemoFlow}
              asIsXml={xml}
              toBeXml={toBeXml}
            />
          </PanelShell>
          {activePanel !== 5 && <div className="absolute inset-0 bg-slate-100/20 pointer-events-none" />}
        </div>

      </div>

      <BurgerMenu
        open={showBurger}
        onClose={() => setShowBurger(false)}
        vimplToken={vimplToken}
        vimplUser={vimplUser}
        onLogout={logoutVimpl}
        onNewFlow={handleCreateFlow}
        onOverview={handleBackToDashboard}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* ── Plan generation prompt modal ──────────────────────────── */}
      {showPlanPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-gray-800">Project parameters</h3>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Project start date</label>
              <input
                type="date"
                value={planStartDate}
                onChange={e => setPlanStartDate(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-vimpl"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Project duration</label>
                <span className="text-xs font-semibold text-gray-700">{planDurationWeeks} weeks</span>
              </div>
              <input
                type="range"
                min={4}
                max={52}
                step={1}
                value={planDurationWeeks}
                onChange={e => setPlanDurationWeeks(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>4 wks</span>
                <span>52 wks</span>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleGeneratePlan}
                className="flex-1 bg-vimpl text-black text-sm font-semibold py-2 rounded-lg hover:bg-vimpl-dark hover:text-white transition-colors"
              >
                Generate
              </button>
              <button
                onClick={() => setShowPlanPrompt(false)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
