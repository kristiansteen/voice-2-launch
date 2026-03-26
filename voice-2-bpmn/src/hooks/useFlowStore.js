import { useState, useEffect } from 'react';

const FLOWS_KEY = 'voice2bpmn_flows';
const ACTIVE_KEY = 'voice2bpmn_active';
const BACKEND_URL = 'https://backend-eight-rho-46.vercel.app';
const PRICING_URL = 'https://frontend-puce-ten-18.vercel.app/pricing';

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

// Owns all flow data state, persistence, and flow navigation.
// UI-only state (loading spinners, modal visibility, active panel) stays in App.jsx.
export function useFlowStore({ vimplToken, vimplUser }) {
  const isSubscribed = vimplUser &&
    (vimplUser.subscriptionTier === 'commercial' || vimplUser.subscriptionTier === 'enterprise');

  // ── Flows list & active flow ──────────────────────────────────────
  const [flows, setFlows] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FLOWS_KEY) || '[]'); }
    catch { return []; }
  });
  const [currentFlowId, setCurrentFlowId] = useState(() =>
    localStorage.getItem(ACTIVE_KEY) || null
  );

  // ── Current flow content state ────────────────────────────────────
  const [transcript, setTranscript] = useState('');
  const [processDescription, setProcessDescription] = useState(null);
  const [processContext, setProcessContext] = useState({
    apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null,
  });
  const [parsed, setParsed] = useState(null);
  const [xml, setXml] = useState(null);
  const [improvements, setImprovements] = useState(null);
  const [selectedImprovementIds, setSelectedImprovementIds] = useState([]);
  const [customRisks, setCustomRisks] = useState([]);
  const [projectPlan, setProjectPlan] = useState(null);
  const [asIsXml, setAsIsXml] = useState(null);
  const [asIsParsed, setAsIsParsed] = useState(null);
  const [toBeXml, setToBeXml] = useState(null);
  const [toBeParsed, setToBeParsed] = useState(null);
  const [asIsMetrics, setAsIsMetrics] = useState(null);
  const [toBeMetrics, setToBeMetrics] = useState(null);
  const [boardUrl, setBoardUrl] = useState(null);
  const [boardId, setBoardId] = useState(null);

  // ── Derived values ────────────────────────────────────────────────
  const currentFlow = flows.find(f => f.id === currentFlowId);
  const isDemoFlow = !!(currentFlow?._demo);
  const canCreateFlow = isSubscribed || flows.filter(f => !f._demo).length === 0;

  // ── Hydrate all content state from a flow object ──────────────────
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

  // ── Restore active flow on mount ──────────────────────────────────
  useEffect(() => {
    if (!currentFlowId) return;
    const stored = JSON.parse(localStorage.getItem(FLOWS_KEY) || '[]');
    const flow = stored.find(f => f.id === currentFlowId);
    if (flow) loadFlowIntoState(flow);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save current flow whenever content state changes ─────────
  useEffect(() => {
    if (!currentFlowId) return;
    if (!transcript && !xml && !parsed) return;
    setFlows(prev => {
      const updated = prev.map(f => f.id === currentFlowId
        ? {
            ...f,
            process_name: parsed?.process_name || processDescription?.process_name || f.process_name,
            updated_at: new Date().toISOString(),
            transcript, processDescription, parsed, xml,
            improvements, selectedImprovementIds, customRisks, projectPlan, processContext,
            asIsXml, asIsParsed, toBeXml, toBeParsed, asIsMetrics, toBeMetrics,
          }
        : f
      );
      try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [currentFlowId, transcript, processDescription, parsed, xml, improvements, selectedImprovementIds, customRisks, projectPlan, processContext, asIsXml, asIsParsed, toBeXml, toBeParsed, asIsMetrics, toBeMetrics]); // eslint-disable-line

  // ── Flow navigation ───────────────────────────────────────────────
  function handleOpenFlow(flowId) {
    const stored = JSON.parse(localStorage.getItem(FLOWS_KEY) || '[]');
    const flow = stored.find(f => f.id === flowId);
    if (!flow) return;
    loadFlowIntoState(flow);
    setCurrentFlowId(flowId);
    localStorage.setItem(ACTIVE_KEY, flowId);
  }

  function handleCreateFlow() {
    if (!canCreateFlow) {
      window.open(PRICING_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newFlow = { id, process_name: 'New process', created_at: now, updated_at: now, ...blankFlowState() };
    setFlows(prev => {
      const updated = [newFlow, ...prev];
      try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
    loadFlowIntoState(newFlow);
    setCurrentFlowId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function handleBackToDashboard() {
    setCurrentFlowId(null);
    localStorage.removeItem(ACTIVE_KEY);
  }

  function handleClearCurrentFlow() {
    const blank = blankFlowState();
    loadFlowIntoState({ ...blank, board_url: null, board_id: null });
    if (currentFlowId) {
      setFlows(prev => {
        const updated = prev.map(f => f.id === currentFlowId
          ? { ...f, ...blank, process_name: 'New process', updated_at: new Date().toISOString() }
          : f
        );
        try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
  }

  async function handleDeleteFlow(flowId, deleteBoard) {
    const stored = JSON.parse(localStorage.getItem(FLOWS_KEY) || '[]');
    const flow = stored.find(f => f.id === flowId);
    if (deleteBoard && flow?.board_id && vimplToken) {
      await fetch(`${BACKEND_URL}/api/v1/boards/${flow.board_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${vimplToken}` },
      }).catch(() => {});
    }
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

  function handleExported(exportedBoardId, url) {
    setBoardUrl(url);
    setBoardId(exportedBoardId);
    if (currentFlowId) {
      setFlows(prev => {
        const updated = prev.map(f => f.id === currentFlowId
          ? { ...f, board_id: exportedBoardId, board_url: url, updated_at: new Date().toISOString() }
          : f
        );
        try { localStorage.setItem(FLOWS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
  }

  return {
    // Flows list
    flows, setFlows,
    currentFlowId, setCurrentFlowId,
    currentFlow, isDemoFlow, canCreateFlow, isSubscribed,

    // Content state
    transcript, setTranscript,
    processDescription, setProcessDescription,
    processContext, setProcessContext,
    parsed, setParsed,
    xml, setXml,
    improvements, setImprovements,
    selectedImprovementIds, setSelectedImprovementIds,
    customRisks, setCustomRisks,
    projectPlan, setProjectPlan,
    asIsXml, setAsIsXml,
    asIsParsed, setAsIsParsed,
    toBeXml, setToBeXml,
    toBeParsed, setToBeParsed,
    asIsMetrics, setAsIsMetrics,
    toBeMetrics, setToBeMetrics,
    boardUrl, setBoardUrl,
    boardId, setBoardId,

    // Actions
    handleOpenFlow,
    handleCreateFlow,
    handleBackToDashboard,
    handleClearCurrentFlow,
    handleDeleteFlow,
    handleExported,
  };
}
