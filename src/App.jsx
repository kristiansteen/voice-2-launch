import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import HelpModal from './components/HelpModal.jsx';
import BurgerMenu from './components/BurgerMenu.jsx';
import { useLang } from './i18n/LangContext.jsx';
import VoicePanel from './components/VoicePanel.jsx';
import DescriptionPanel from './components/DescriptionPanel.jsx';
import DiagramPanel from './components/DiagramPanel.jsx';
import ImprovePanel from './components/ImprovePanel.jsx';
import LaunchPanel from './components/LaunchPanel.jsx';
import Dashboard from './components/Dashboard.jsx';
import RoundContribution from './components/RoundContribution.jsx';
import RoundsPanel from './components/RoundsPanel.jsx';

// AS-IS rounds need the online backend; the offline build hides them
const ROUNDS_ENABLED = import.meta.env.VITE_OFFLINE !== 'true';
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
  matchRoundSteps,
} from './services/anthropicService.js';
import {
  versionsFromRound, stepRefs, validateGroups, combine, combinedTranscript, groupingLooksBroken, resolveDisagreement,
} from './lib/roundMerge.js';
import { generateBpmnXml } from './services/xmlGenerator.js';
import { comparisonToImprovements } from './services/processComparison.js';
import { useAileanInterviewer } from './hooks/useAileanInterviewer.js';
import {
  INVITE_PARAM, readInviteFromSearch, rememberInvite, takePendingInvite, holdInvite, heldInvite, releaseInvite,
} from './lib/roundInvite.js';
import { onTokenRefreshed, listRounds } from './services/roundService.js';
import { buildStructuredTranscript } from './lib/transcript.js';
import { compareTimes } from './lib/processMetrics.js';
import { computeBusinessCase } from './lib/businessCase.js';
import { carryValueFields } from './lib/valueAnalysis.js';
import { setPreferencesToken, loadPreferences, savePreferences, applyPreferencesToStorage, taxonomyPreferencesFromStorage } from './services/preferencesService.js';

// Business case shown in the demo (inputs only; the money is computed from the demo times)
const DEMO_BUSINESS_CASE = {
  da: { volumePerMonth: 60, hourlyRate: 450, oneOffCost: 1500000, runCostPerYear: 120000, currency: 'DKK',
        sources: { volumePerMonth: 'stated', hourlyRate: 'stated', oneOffCost: 'estimated' },
        problem: 'Fakturaer betales for sent, og kreditorbogholderiet bruger mange timer på manuel kontrol og rykkere.',
        target: '95 % af fakturaerne betalt til tiden; halvering af behandlingstiden pr. faktura.' },
  en: { volumePerMonth: 60, hourlyRate: 60, oneOffCost: 200000, runCostPerYear: 16000, currency: 'EUR',
        sources: { volumePerMonth: 'stated', hourlyRate: 'stated', oneOffCost: 'estimated' },
        problem: 'Invoices are paid late, and accounts payable spends many hours on manual checks and reminders.',
        target: '95 % of invoices paid on time; half the handling time per invoice.' },
};
const withDemoBusinessCase = isDa => prev => (prev && Object.keys(prev).length ? prev : DEMO_BUSINESS_CASE[isDa ? 'da' : 'en']);
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
import { useCompanyLogo } from './hooks/useCompanyLogo.js';
import { useSystemRepository } from './hooks/useSystemRepository.js';

const BACKEND_URL    = 'https://backend-eight-rho-46.vercel.app';
const VIMPL_LOGIN_URL = 'https://app.vimpl.com/login.html';

// One step's working area. The step bar above names the step, so the panel has no header of its own.
// The diagram (wide) runs edge to edge; the other steps sit in a centred panel.
function PanelShell({ wide = false, children }) {
  if (wide) {
    return <div className="flex flex-col h-full bg-panel">{children}</div>;
  }
  return (
    <div className="h-full overflow-hidden bg-paper px-3 sm:px-6 py-4">
      <div className="flex flex-col h-full w-full max-w-[1100px] mx-auto bg-panel border border-line rounded-[10px] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

const FLOWS_KEY_BASE  = 'voice2bpmn_flows';
const ACTIVE_KEY_BASE = 'voice2bpmn_active';
const LAST_USER_KEY   = 'voice2bpmn_last_user';
const PRICING_URL = 'https://ailean.dk/ailean-pricing';

function flowsKey(userId)  { return userId ? `${FLOWS_KEY_BASE}_${userId}`  : FLOWS_KEY_BASE;  }
function activeKey(userId) { return userId ? `${ACTIVE_KEY_BASE}_${userId}` : ACTIVE_KEY_BASE; }

// Read from the previous session's userId so lazy initialisers can use the correct key before auth resolves
const storedUserId = (() => { try { return localStorage.getItem(LAST_USER_KEY) || null; } catch { return null; } })();

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
    blueprintXml: null,
    asIsMetrics: null,
    toBeMetrics: null,
    businessCase: {},
    systemMap: {},
    videoMap: {},
    comparisonResult: null,
    roundSnapshot: null,
    board_url: null,
    board_id: null,
  };
}

export default function App() {
  const { t, lang, setLang, syncLang } = useLang();
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

  // On mount: restore session from the httpOnly refreshToken cookie, or pick up a
  // ?token= param (Google OAuth redirect from the backend lands on /callback?token=...
  // — the SPA catch-all rewrite serves index.html there, so this is the only place
  // that token is ever read) or a ?code= param.
  useEffect(() => {
    // AS-IS round invite (?round=…): remember it before any login redirect drops the query string
    const inviteToken = readInviteFromSearch(window.location.search);
    if (inviteToken) {
      rememberInvite(localStorage, inviteToken);
      const url = new URL(window.location.href);
      url.searchParams.delete(INVITE_PARAM);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const code = params.get('code');

    if (token) {
      // Google OAuth redirect — access token is already in the URL, no exchange needed.
      window.history.replaceState(null, '', '/');
      setVimplToken(token);
      setAuthLoading(false);
    } else if (code) {
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
  // Account preferences (B40): language and taxonomy follow the user across browsers
  useEffect(() => {
    setPreferencesToken(vimplToken);
    if (!vimplToken) return;
    let cancelled = false;
    loadPreferences().then(prefs => {
      if (cancelled || !prefs) return; // null: not available yet, keep this browser's choices
      if (Object.keys(prefs).length === 0) {
        savePreferences({ preferredLang: lang, ...taxonomyPreferencesFromStorage() });
        return;
      }
      const saved = applyPreferencesToStorage(prefs);
      if (saved && saved !== lang) syncLang(saved);
    });
    return () => { cancelled = true; };
  }, [vimplToken]); // eslint-disable-line react-hooks/exhaustive-deps
  const [vimplUser, setVimplUser] = useState(null);
  // Invite token of an AS-IS round the user opened; shows the contribution screen once logged in
  const [pendingInvite, setPendingInvite] = useState(null);
  const [showRounds, setShowRounds] = useState(false);
  // Rounds appear only once the backend serves them (its tables are created by hand with prisma db push)
  const [roundsAvailable, setRoundsAvailable] = useState(false);
  useEffect(() => {
    if (!ROUNDS_ENABLED || !vimplToken) { setRoundsAvailable(false); return; }
    let cancelled = false;
    listRounds(vimplToken)
      .then(() => { if (!cancelled) setRoundsAvailable(true); })
      .catch(() => { if (!cancelled) setRoundsAvailable(false); });
    return () => { cancelled = true; };
  }, [vimplToken]);
  useEffect(() => {
    // A new invite from the login round trip, or the one held across a reload
    if (vimplToken) setPendingInvite(prev => prev || takePendingInvite(localStorage) || heldInvite(sessionStorage));
  }, [vimplToken]);
  useEffect(() => { if (pendingInvite) holdInvite(sessionStorage, pendingInvite); }, [pendingInvite]);
  // The rounds client refreshes an expired access token itself; keep the app's copy in step
  useEffect(() => { onTokenRefreshed(setVimplToken); return () => onTokenRefreshed(null); }, []);
  const userId = vimplUser?.id ?? null;
  const { logo: companyLogo, setLogo: setCompanyLogo, removeLogo: removeCompanyLogo, loadFile: loadLogoFile } = useCompanyLogo(userId);
  const { systems: systemRepository, addSystem, removeSystem, importFromText: importSystems } = useSystemRepository(userId);
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

  // ── Persist userId so lazy initialisers can use the correct key next page load ──
  useEffect(() => {
    if (!userId) return;
    try { localStorage.setItem(LAST_USER_KEY, userId); } catch {}
    // If the lazy init used a different (or no) storedUserId, re-load from the correct key
    if (userId !== storedUserId) {
      try {
        const stored = JSON.parse(localStorage.getItem(flowsKey(userId)) || '[]');
        if (stored.length > 0) setFlows(stored.map(f => f.id ? f : { ...f, id: crypto.randomUUID() }));
        const activeId = localStorage.getItem(activeKey(userId));
        if (activeId) setCurrentFlowId(activeId);
      } catch {}
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
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
      // Use the stored userId (from previous session) so the correct per-user key is read before auth resolves
      const stored = JSON.parse(localStorage.getItem(flowsKey(storedUserId)) || '[]');
      return stored.map(f => f.id ? f : { ...f, id: crypto.randomUUID() });
    }
    catch { return []; }
  });
  const [currentFlowId, setCurrentFlowId] = useState(() => {
    return localStorage.getItem(activeKey(storedUserId)) || null;
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
        try { localStorage.setItem(flowsKey(userId), JSON.stringify(merged)); } catch {}
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
      position: 'absolute', top: 0, bottom: 0, width: '100%', overflow: 'hidden',
      transition: 'left 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.25s',
    };
    // One step at a time, full width; the others wait off-screen, still mounted
    if (offset === 0) return { ...base, left: '0%', opacity: 1, zIndex: 10 };
    return { ...base, left: offset < 0 ? '-100%' : '100%', opacity: 0, zIndex: 0, pointerEvents: 'none', visibility: 'hidden' };
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
  // Scope of the AS-IS round being contributed to: its language and the context sent to the interviewer
  const [roundScope, setRoundScope] = useState(null);
  const ailean = useAileanInterviewer(roundScope?.language || lang, { contextMessage: roundScope?.message });

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

  // Panel 3 — AS-IS / TO-BE / Blueprint
  const [asIsXml, setAsIsXml] = useState(null);
  const [asIsParsed, setAsIsParsed] = useState(null);
  const [toBeXml, setToBeXml] = useState(null);
  const [toBeParsed, setToBeParsed] = useState(null);
  const [toBeLoading, setToBeLoading] = useState(false);
  const [toBeApproved, setToBeApproved] = useState(false);
  const [blueprintXml, setBlueprintXml] = useState(null);

  // Process metrics (activities: duration + backlog; gateways: branch rates)
  const [asIsMetrics, setAsIsMetrics] = useState(null);
  const [businessCaseInputs, setBusinessCaseInputs] = useState({});
  const [toBeMetrics, setToBeMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [systemMap, setSystemMap] = useState({});
  const [videoMap, setVideoMap] = useState({});
  const [comparisonResult, setComparisonResult] = useState(null);
  // Set when the flow was created from AS-IS round submissions: versions, disagreements, resolutions
  const [roundSnapshot, setRoundSnapshot] = useState(null);
  const [roundUseError, setRoundUseError] = useState(null);
  const [planSource, setPlanSource] = useState('improvements'); // 'improvements' | 'comparison'

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
    // Never hand the previous user's round invitation to whoever logs in next in this tab
    releaseInvite(sessionStorage);
    takePendingInvite(localStorage);
    setPendingInvite(null);
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
    // Clear per-user and generic localStorage so the next user starts clean
    try {
      if (userId) {
        localStorage.removeItem(flowsKey(userId));
        localStorage.removeItem(activeKey(userId));
      }
      localStorage.removeItem(FLOWS_KEY_BASE);
      localStorage.removeItem(ACTIVE_KEY_BASE);
      localStorage.removeItem(LAST_USER_KEY);
    } catch {}
    // Clearing localStorage isn't enough on its own — `flows` is in-memory
    // React state and survives a logout with no page reload. Without this,
    // whoever logs in next (same tab) inherits the outgoing user's flows in
    // memory: the API-merge effect sees them as "local-only" (since they
    // aren't in the new user's empty remote list) and both re-displays them
    // AND writes them into the new user's own localStorage key.
    setFlows([]);
    setCurrentFlowId(null);
    setVimplUser(null);
    setVimplToken(null);
    setLoggedOut(true);
  }

  // ── Migrate old single-draft format to multi-flow on first run ────
  useEffect(() => {
    try {
      const oldDraft = localStorage.getItem('voice2bpmn_draft');
      const existingFlows = JSON.parse(localStorage.getItem(flowsKey(userId)) || '[]');
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
        localStorage.setItem(flowsKey(userId), JSON.stringify(newFlows));
        localStorage.removeItem('voice2bpmn_draft');
        setFlows(newFlows);
        if (draft.transcript || draft.parsed) {
          loadFlowIntoState(migrated);
          setCurrentFlowId(id);
          localStorage.setItem(activeKey(userId), id);
        }
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore active flow on mount ───────────────────────────────────
  // Must use storedUserId (not userId) because vimplUser hasn't loaded yet at this point
  useEffect(() => {
    if (!currentFlowId) return;
    const stored = JSON.parse(localStorage.getItem(flowsKey(storedUserId)) || '[]');
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
    setBlueprintXml(flow.blueprintXml || null);
    setAsIsMetrics(flow.asIsMetrics || null);
    setToBeMetrics(flow.toBeMetrics || null);
    setBusinessCaseInputs(flow.businessCase || {});
    setSystemMap(flow.systemMap || {});
    setVideoMap(flow.videoMap || {});
    setComparisonResult(flow.comparisonResult || null);
    setRoundSnapshot(flow.roundSnapshot || null);
    setBoardUrl(flow.board_url || null);
    setBoardId(flow.board_id || null);
    setBoardVersion(flow.board_version || 1);
  }

  // Times and money for the Plan screen and exports; recomputed only when their inputs change
  const timeComparison = useMemo(
    () => compareTimes(asIsParsed || parsed, asIsMetrics, toBeParsed, toBeMetrics),
    [asIsParsed, parsed, asIsMetrics, toBeParsed, toBeMetrics],
  );
  const businessCase = useMemo(
    () => computeBusinessCase({ asIsParsed: asIsParsed || parsed, asIsMetrics, toBeParsed, toBeMetrics, inputs: businessCaseInputs }),
    [asIsParsed, parsed, asIsMetrics, toBeParsed, toBeMetrics, businessCaseInputs],
  );

  // ── Auto-save current flow whenever key state changes ─────────────
  useEffect(() => {
    if (!currentFlowId) return;
    clearTimeout(apiSaveTimer.current); // always cancel pending save before deciding what to do
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
      asIsXml, asIsParsed, toBeXml, toBeParsed, blueprintXml, asIsMetrics, toBeMetrics, systemMap, videoMap, comparisonResult,
      roundSnapshot, businessCase: businessCaseInputs,
    };
    setFlows(prev => {
      const updated = prev.map(f => f.id === currentFlowId ? updatedFlow : f);
      try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
      return updated;
    });
    // Debounced API sync (skip demo flows)
    if (vimplToken && !base._demo) {
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
              localStorage.setItem(activeKey(userId), newId);
              setFlows(prev => {
                const updated = prev.map(f => f.id === updatedFlow.id ? reflowed : f);
                try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
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
  }, [currentFlowId, transcript, processDescription, parsed, xml, improvements, selectedImprovementIds, customRisks, projectPlan, processContext, asIsXml, asIsParsed, toBeXml, toBeParsed, blueprintXml, asIsMetrics, toBeMetrics, systemMap, videoMap, comparisonResult, roundSnapshot, businessCaseInputs]); // eslint-disable-line

  // ── Flow navigation ────────────────────────────────────────────────
  function handleConfirmLang() {
    setLang(lang);
    setLangConfirmed(true);
  }

  function handleOpenFlow(flowId) {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) return;
    ailean.reset(); // clear interviewer turns so they don't bleed into the new flow
    loadFlowIntoState(flow);
    setCurrentFlowId(flowId);
    setLangConfirmed(false);
    localStorage.setItem(activeKey(userId), flowId);
  }

  async function handleCreateFlow() {
    if (!canCreateFlow) {
      window.open(PRICING_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    createFlowWith(null);
  }

  // Creates a flow and opens it; `initial` pre-fills it (used for AS-IS round submissions)
  function createFlowWith(initial) {
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
      ...(initial || {}),
    };
    setFlows(prev => {
      const updated = [newFlow, ...prev];
      try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (vimplToken) upsertFlow(vimplToken, newFlow).catch(() => {});
    ailean.reset(); // clear interviewer turns so they don't bleed into the new flow
    // Reset all content state
    setTranscript(initial?.transcript || '');
    setProcessDescription(initial?.processDescription || null);
    setRoundSnapshot(initial?.roundSnapshot || null);
    setComparisonResult(null);
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
    setBlueprintXml(null);
    setAsIsMetrics(null);
    setToBeMetrics(null);
    setBusinessCaseInputs({});
    setProcessContext(initial?.processContext || { apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
    setBoardUrl(null);
    setBoardId(null);
    setCurrentFlowId(id);
    setLangConfirmed(false);
    localStorage.setItem(activeKey(userId), id);
  }

  function handleBackToDashboard() {
    setCurrentFlowId(null);
    localStorage.removeItem(activeKey(userId));
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
    setBlueprintXml(null);
    setAsIsMetrics(null);
    setToBeMetrics(null);
    setBusinessCaseInputs({});
    setSystemMap({});
    setProcessContext({ apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
    setBoardUrl(null);
    setBoardId(null);
    if (currentFlowId) {
      setFlows(prev => {
        const updated = prev.map(f => f.id === currentFlowId
          ? { ...f, ...blankFlowState(), process_name: 'New process', updated_at: new Date().toISOString() }
          : f
        );
        try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
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
      try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  // Classify a process from the overview: same shape the taxonomy picker writes
  function handleClassifyFlow(flowId, node) {
    setFlows(prev => {
      const updated = prev.map(f => {
        if (f.id !== flowId) return f;
        const updatedFlow = { ...f, processContext: { ...(f.processContext || {}), apqcNodeId: node.id, apqcNodeName: node.name, apqcNodeLevel: node.level, isCustom: false } };
        if (vimplToken && !f._demo) upsertFlow(vimplToken, updatedFlow).catch(() => {});
        return updatedFlow;
      });
      try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (flowId === currentFlowId) setProcessContext(pc => ({ ...pc, apqcNodeId: node.id, apqcNodeName: node.name, apqcNodeLevel: node.level, isCustom: false }));
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
      try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (currentFlowId === flowId) {
      setCurrentFlowId(null);
      localStorage.removeItem(activeKey(userId));
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
        try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
        return updated;
      });
      setTranscript(''); setProcessDescription(null); setParsed(null); setXml(null);
      setImprovements(null); setSelectedImprovementIds([]); setCustomRisks([]);
      setProjectPlan(null); setAsIsXml(null); setAsIsParsed(null);
      setToBeXml(null); setToBeParsed(null); setAsIsMetrics(null); setToBeMetrics(null); setBusinessCaseInputs({});
      setProcessContext({ apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
      setBoardUrl(null); setBoardId(null);
      setActivePanel(1);
      setCurrentFlowId(id);
      setLangConfirmed(false);
      localStorage.setItem(activeKey(userId), id);
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
      try { localStorage.setItem(flowsKey(userId), JSON.stringify(updated)); } catch {}
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
    setBusinessCaseInputs({});
    setProcessContext(demoContext);
    setBoardUrl(null);
    setBoardId(null);
    setVoiceError(null);
    setActivePanel(1);

    setCurrentFlowId(flowId);
    setLangConfirmed(false);
    localStorage.setItem(activeKey(userId), flowId);
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
      console.error('[parseVoiceToDescription] failed:', err, err.rawResponse);
      setVoiceError(err.message || 'Failed to parse voice.');
    } finally {
      setDescParsing(false);
    }
  }

  // ── AS-IS rounds: turn submissions into a flow (snapshot) ──────────
  // One version: its description as is. Several: the AI groups steps that are the same,
  // the rest (disagreements, majority draft) is computed in roundMerge.js.
  async function handleUseSubmissions({ round, submissionIds, mode }) {
    setRoundUseError(null);
    const versions = versionsFromRound(round, submissionIds, vimplUser?.email);
    if (!versions.length) return;
    const roundLang = round.language === 'da' ? 'da' : 'en';
    let description, disagreements = [];
    if (versions.length === 1) {
      description = { ...versions[0].description, process_name: round.processName };
    } else {
      const refs = stepRefs(versions);
      let raw;
      try {
        raw = await matchRoundSteps(refs, effectiveApiKey, getProxyAuth(), roundLang);
      } catch (err) {
        console.error('[matchRoundSteps] failed:', err);
        setRoundUseError(t.roundsUseFailed);
        return;
      }
      const groups = validateGroups(raw, refs);
      // A grouping that matched almost nothing would give an empty draft; treat it as a failure
      if (groupingLooksBroken(groups, refs)) {
        console.error('[matchRoundSteps] grouping matched almost nothing:', raw);
        setRoundUseError(t.roundsUseFailed);
        return;
      }
      ({ description, disagreements } = combine(versions, groups, round.processName));
    }
    const snapshot = {
      roundId: round.id,
      processName: round.processName,
      createdAt: new Date().toISOString(),
      versions: versions.map(v => ({ id: v.id, name: v.name, transcript: v.transcript })),
      disagreements,
      resolutions: {},
    };
    const initial = {
      process_name: round.processName,
      transcript: versions.length === 1 ? versions[0].transcript : combinedTranscript(versions),
      processDescription: description,
      processContext: { apqcNodeId: null, apqcNodeName: null, isCustom: true, customLabel: round.processName },
      roundSnapshot: snapshot,
    };
    createFlowWith(initial);
    setShowRounds(false);
    setLangConfirmed(true);
    setActivePanel(2);
    if (mode === 'diagram') {
      await handleApproveToBpmn(false, { description, transcript: initial.transcript, processContext: initial.processContext });
    }
  }

  // The owner settles one disagreement in the Review pane
  // optionKey null = keep the draft as it is (records the decision, leaves hand edits alone)
  function handleResolveDisagreement(disagreementId, optionKey) {
    const r = resolveDisagreement(processDescription, roundSnapshot, disagreementId, optionKey);
    setProcessDescription(r.description);
    setRoundSnapshot(r.snapshot);
  }

  async function handleApproveToBpmn(useExtendedTokens = false, override = null) {
    // override: { description, transcript, processContext } for a flow whose state has not landed yet
    // ("Open as process diagram" approves in the same click that creates the flow)
    const ov = override && !override.nativeEvent ? override : null;
    const description = ov?.description || processDescription;
    const context = ov?.processContext || processContext;
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
    const descSize = JSON.stringify(description).length;
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
      const bpmnJson = await parseToBpmn(description, effectiveApiKey, context, getProxyAuth(), lang, maxTokens);
      setParsed(bpmnJson);
      let generatedXml;
      try {
        generatedXml = await generateBpmnXml(bpmnJson);
      } catch (xmlErr) {
        console.error('[generateBpmnXml] failed:', xmlErr, bpmnJson);
        throw new Error(`Diagram generation failed: ${xmlErr.message}`);
      }
      setXml(generatedXml);
      setActivePanel(3);
      // Background: extract AS-IS metrics from transcript
      const _transcript = ov ? ov.transcript : getEffectiveTranscript();
      const _apiKey = effectiveApiKey;
      const _proxyAuth = getProxyAuth();
      setMetricsLoading(true);
      extractProcessMetrics(bpmnJson, _transcript, _apiKey, _proxyAuth, lang)
        .then(m => { if (m) setAsIsMetrics(prev => carryValueFields(prev, m)); })
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
    // Value classes from the value view steer the improvements towards waste first
    const valueByActivity = Object.fromEntries((asIsMetrics?.activities || [])
      .filter(m => m.value_class)
      .map(m => [m.id, { value_class: m.value_class, ...(m.waste_type ? { waste_type: m.waste_type } : {}) }]));
    const result = await getStructuredImprovements(parsed, effectiveApiKey, getProxyAuth(), lang, valueByActivity);
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
      setBusinessCaseInputs(withDemoBusinessCase(isDa));
      setActivePanel(5);
      return;
    }
    const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
    if (!selected.length) return;
    // Pre-fill start date to today
    setPlanStartDate(new Date().toISOString().slice(0, 10));
    setPlanDurationWeeks(14);
    setPlanSource('improvements');
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
      setBusinessCaseInputs(withDemoBusinessCase(isDa));
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
        .then(m => { if (m) setToBeMetrics(prev => carryValueFields(prev, m)); })
        .catch(() => {});
    } finally {
      setToBeLoading(false);
    }
  }

  // Opens the shared project-parameters modal, flagged to build the plan from
  // the blueprint comparison instead of the usual selected AI improvements.
  function handleRequestPlanFromComparison() {
    if (!comparisonResult) return;
    setPlanStartDate(new Date().toISOString().slice(0, 10));
    setPlanDurationWeeks(14);
    setPlanSource('comparison');
    setShowPlanPrompt(true);
  }

  async function handleGeneratePlanFromComparison() {
    setShowPlanPrompt(false);
    if (!comparisonResult) return;
    const derived = comparisonToImprovements(comparisonResult);
    if (!derived.length) return;

    setPlanLoading(true);
    try {
      const plan = await generateProjectPlan(asIsParsed || parsed, derived, effectiveApiKey, customRisks, getProxyAuth(), planStartDate || null, planDurationWeeks, lang);
      setProjectPlan({ ...plan, _startDate: planStartDate || null, _source: 'comparison' });
      setActivePanel(5);
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleGeneratePlan() {
    setShowPlanPrompt(false);
    setPlanSource('improvements');
    const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
    if (!selected.length) return;

    setPlanLoading(true);
    try {
      const plan = await generateProjectPlan(parsed, selected, effectiveApiKey, customRisks, getProxyAuth(), planStartDate || null, planDurationWeeks, lang);
      setProjectPlan({ ...plan, _startDate: planStartDate || null, _source: 'improvements' });
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

  // ── AS-IS round contribution (opened from an invite link) ──────────
  if (ROUNDS_ENABLED && vimplToken && pendingInvite) {
    return (
      <RoundContribution
        key={pendingInvite}
        vimplToken={vimplToken}
        inviteToken={pendingInvite}
        ailean={ailean}
        onScope={setRoundScope}
        onDone={() => {
          // Clear the round's interview so it does not bleed into the user's own flows
          ailean.reset();
          setRoundScope(null);
          releaseInvite(sessionStorage);
          setPendingInvite(null);
        }}
      />
    );
  }

  // ── AS-IS rounds (owner) ───────────────────────────────────────────
  if (ROUNDS_ENABLED && showRounds && !currentFlowId) {
    return (
      <RoundsPanel
        vimplToken={vimplToken}
        vimplUser={vimplUser}
        onBack={() => setShowRounds(false)}
        onContribute={token => setPendingInvite(token)}
        onUseSubmissions={handleUseSubmissions}
        useError={roundUseError}
      />
    );
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
          onClassify={handleClassifyFlow}
          canCreate={canCreateFlow}
          onLogout={logoutVimpl}
          onDemo={handleLoadDemo}
          onBurger={() => setShowBurger(true)}
          onOpenRounds={roundsAvailable ? () => setShowRounds(true) : undefined}
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
          companyLogo={companyLogo}
          onLogoChange={async (file) => { const url = await loadLogoFile(file); setCompanyLogo(url); return url; }}
          onLogoRemove={removeCompanyLogo}
          systemRepository={systemRepository}
          onAddSystem={addSystem}
          onRemoveSystem={removeSystem}
          onImportSystems={importSystems}
        />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-paper">
      {/* Header — as on ailean.dk: wordmark, where you are, status and menu */}
      <header className="bg-paper border-b border-line shrink-0">
        <div className="flex items-center gap-4 sm:gap-6 h-14 px-4 sm:px-8">
          <button onClick={handleBackToDashboard} className="ailean-logo" title={t.stepBackToFlows}>AILEAN</button>
          <nav aria-label={t.stepWhere} className="hidden sm:flex items-center gap-2 text-sm min-w-0">
            <button onClick={handleBackToDashboard} className="text-mid hover:text-ink shrink-0">{t.stepMyFlows}</button>
            <span className="text-line">/</span>
            <span className="truncate">{currentFlow?.process_name || currentFlow?.name || processDescription?.process_name || ''}</span>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-mid">
                <span className="w-3 h-3 border-2 border-line border-t-mid rounded-full animate-spin shrink-0" />
                {t.stepSaving}
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-mid">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ink" />
                {t.stepSaved}
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                onClick={() => { setSaveStatus('idle'); upsertFlow(vimplToken, flows.find(f => f.id === currentFlowId)).catch(() => setSaveStatus('error')); }}
                className="text-xs text-red-600 hover:text-red-800 underline"
              >
                {t.stepSaveFailed}
              </button>
            )}
            <button
              onClick={handleToggleDemo}
              className={[
                'text-xs font-medium rounded-full px-3 py-1.5 border transition-colors',
                isDemoFlow ? 'bg-ink text-paper border-ink' : 'text-mid border-line hover:border-ink hover:text-ink',
              ].join(' ')}
              title={isDemoFlow ? 'Exit demo mode' : t.loadDemoTitle}
            >
              {isMobile ? (isDemoFlow ? '●' : 'Demo') : (isDemoFlow ? t.demoMode : t.tryDemo)}
            </button>
            {!isMobile && (transcript || xml) && (
              <button
                onClick={handleClearCurrentFlow}
                className="text-xs text-mid hover:text-red-600 border border-line rounded-full px-3 py-1.5 transition-colors"
                title={t.clearTitle}
              >
                {t.clear}
              </button>
            )}
            <button
              onClick={() => setShowBurger(true)}
              aria-label={t.stepMenu}
              className="w-9 h-9 rounded-full border border-line bg-panel hover:border-ink flex flex-col gap-1 items-center justify-center transition-colors"
            >
              <span className="w-3.5 h-px bg-ink" />
              <span className="w-3.5 h-px bg-ink" />
              <span className="w-3.5 h-px bg-ink" />
            </button>
          </div>
        </div>
      </header>

      {/* Step bar — the five steps, in the form of the selector on ailean.dk */}
      {(() => {
        const done = {
          1: !!processDescription,
          2: !!parsed,
          3: !!(improvements && improvements.length),
          4: !!(toBeXml || projectPlan),
          5: !!projectPlan,
        };
        const steps = [1, 2, 3, 4, 5].map(n => ({ num: n, label: t[`panel${n}`], sub: t[`panel${n}Sub`] }));
        return (
          <nav aria-label={t.stepSteps} className="shrink-0 bg-paper px-3 sm:px-8 pt-3">
            <ol className="grid grid-cols-5 gap-1.5">
              {steps.map(s => {
                const active = activePanel === s.num;
                const finished = !active && done[s.num];
                return (
                  <li key={s.num}>
                    <button
                      onClick={() => setActivePanel(s.num)}
                      aria-current={active ? 'step' : undefined}
                      className={[
                        'w-full flex items-center gap-2.5 rounded-[10px] border text-left transition-colors min-h-[44px]',
                        isMobile ? 'justify-center px-2 py-2' : 'px-3.5 py-2',
                        active ? 'bg-ink text-paper border-ink' : 'bg-panel text-ink border-line hover:border-ink',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden="true"
                        className={[
                          'w-[22px] h-[22px] rounded-full grid place-items-center text-xs tabular-nums shrink-0 border',
                          active ? 'bg-signal border-signal text-ink font-medium'
                            : finished ? 'bg-ink border-ink text-paper'
                            : 'border-line text-mid',
                        ].join(' ')}
                      >
                        {finished ? '✓' : s.num}
                      </span>
                      {!isMobile && (
                        <span className="flex flex-col leading-tight min-w-0">
                          <span className="text-sm font-medium truncate">{s.label}</span>
                          <span className={`text-xs truncate ${active ? 'text-[#B9B9B3]' : 'text-mid'}`}>{s.sub}</span>
                        </span>
                      )}
                      {isMobile && <span className="sr-only">{s.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        );
      })()}

      {/* Carousel */}
      <div className="relative flex-1 bg-paper overflow-hidden mt-3 border-t border-line">

        {/* Panel 1 — Voice */}
        <div style={getCarouselStyle(1)} onClick={activePanel !== 1 ? () => setActivePanel(1) : undefined}>
          <PanelShell>
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
          <PanelShell>
            {showExtendedTokensPrompt && (
              <div className="absolute inset-x-0 top-0 z-20 mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
                <p className="text-sm font-medium text-ink mb-1">Large process detected</p>
                <p className="text-xs text-ink mb-3">
                  This process description exceeds the standard 4 000-token limit and may be truncated,
                  causing the BPMN generation to fail. Would you like to continue with an extended
                  8 000-token limit instead?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveToBpmn(true)}
                    className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-ink text-paper hover:bg-ink-hover transition-colors"
                  >
                    Use extended limit (8 000 tokens)
                  </button>
                  <button
                    onClick={() => handleApproveToBpmn(false)}
                    className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-white border border-amber-200 text-ink hover:bg-amber-100 transition-colors"
                  >
                    Continue with standard (4 000)
                  </button>
                  <button
                    onClick={() => setShowExtendedTokensPrompt(false)}
                    className="px-3 text-xs text-ink hover:text-ink transition-colors"
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
              roundSnapshot={roundSnapshot}
              onResolveDisagreement={handleResolveDisagreement}
            />
          </PanelShell>
          {activePanel !== 2 && <div className="absolute inset-0 bg-slate-100/20 pointer-events-none" />}
        </div>

        {/* Panel 3 — Diagram */}
        <div style={getCarouselStyle(3)} onClick={activePanel !== 3 ? () => setActivePanel(3) : undefined}>
          <PanelShell wide>
            <DiagramPanel
              flowId={currentFlowId}
              isDemo={isDemoFlow}
              xml={xml}
              onXmlChange={setXml}
              bpmnLoading={bpmnParsing}
              processName={parsed?.process_name}
              parsed={parsed}
              toBeParsed={toBeParsed}
              businessCase={businessCase}
              businessCaseInputs={businessCaseInputs}
              processDescription={processDescription}
              onGetImprovements={handleGetImprovements}
              apiKey={hasAccess ? (effectiveApiKey || 'granted') : (isDemoFlow ? 'demo' : null)}
              proxyAuth={getProxyAuth()}
              companyLogo={companyLogo}
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
                  .then(m => { if (m) setAsIsMetrics(prev => carryValueFields(prev, m)); })
                  .catch(() => {})
                  .finally(() => setMetricsLoading(false));
              }}
              onEstimateToBeMetrics={() => {
                if (!parsed || !toBeParsed) return;
                const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
                estimateToBeMetrics(parsed, toBeParsed, asIsMetrics, selected, effectiveApiKey, getProxyAuth(), lang)
                  .then(m => { if (m) setToBeMetrics(prev => carryValueFields(prev, m)); })
                  .catch(() => {});
              }}
              systemRepository={systemRepository}
              systemMap={systemMap}
              onUpdateSystemMap={(elementId, system) => setSystemMap(prev => ({ ...prev, [elementId]: system }))}
              onAddSystem={addSystem}
              videoMap={videoMap}
              onUpdateVideoMap={(elementId, url) => setVideoMap(prev => ({ ...prev, [elementId]: url }))}
              comparisonResult={comparisonResult}
              onComparisonResultChange={setComparisonResult}
              onUseComparisonForPlan={handleRequestPlanFromComparison}
              blueprintXml={blueprintXml}
              onBlueprintXmlChange={setBlueprintXml}
              openRoundPoints={(roundSnapshot?.disagreements || []).filter(d => !roundSnapshot.resolutions?.[d.id]).length}
                onShowReview={() => setActivePanel(2)}
              />
          </PanelShell>
          {activePanel !== 3 && <div className="absolute inset-0 bg-slate-100/20 pointer-events-none" />}
        </div>

        {/* Panel 4 — Plan */}
        <div style={getCarouselStyle(4)} onClick={activePanel !== 4 ? () => setActivePanel(4) : undefined}>
          <PanelShell>
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
          <PanelShell>
            <LaunchPanel
              timeComparison={timeComparison}
              businessCase={businessCase}
              businessCaseInputs={businessCaseInputs}
              onBusinessCaseChange={setBusinessCaseInputs}
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
        currentFlowId={currentFlowId}
        flowName={currentFlow?.process_name || currentFlow?.name}
        companyLogo={companyLogo}
        onLogoChange={async (file) => { const url = await loadLogoFile(file); setCompanyLogo(url); return url; }}
        onLogoRemove={removeCompanyLogo}
        systemRepository={systemRepository}
        onAddSystem={addSystem}
        onRemoveSystem={removeSystem}
        onImportSystems={importSystems}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* ── Plan generation prompt modal ──────────────────────────── */}
      {showPlanPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Project parameters</h3>
              {planSource === 'comparison' && (
                <p className="text-xs text-violet-600 mt-1">Using the blueprint comparison results as plan input.</p>
              )}
            </div>
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
                onClick={planSource === 'comparison' ? handleGeneratePlanFromComparison : handleGeneratePlan}
                className="flex-1 bg-ink text-paper text-sm font-semibold py-2 rounded-full hover:bg-ink-hover transition-colors"
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
