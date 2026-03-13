/**
 * Taxonomy DB — localStorage-backed store for BPMN processes mapped to APQC nodes.
 */
import { APQC_NODES, getDescendantIds } from '../data/apqcTaxonomy.js';

const STORAGE_KEY = 'voice2bpmn_taxonomy_db';

// ─── Deviation thresholds ────────────────────────────────────────────────────
const THRESHOLD_NEAR      = 0.20;
const THRESHOLD_CONFIGURED = 0.50;

// ─── Storage helpers ─────────────────────────────────────────────────────────

function readDb() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"processes":[],"elements":[]}');
    // Backwards-compat: fill missing fields on old records
    raw.processes = (raw.processes || []).map(p => ({
      apqcNodeId: null,
      apqcNodeName: null,
      isCustom: false,
      customLabel: null,
      processType: 'unclassified',
      deviationScore: null,
      deviationLabel: null,
      blueprintRefId: null,
      snapshot: null,
      fingerprint: null,
      ...p,
    }));
    return raw;
  } catch {
    return { processes: [], elements: [] };
  }
}

function writeDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Auto-mapping ─────────────────────────────────────────────────────────────

/**
 * Find the best-matching APQC node for a given element name using keyword scoring.
 * Returns the matched node, or null if no keyword matched.
 */
export function suggestApqcNode(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  let bestNode = null;
  let bestScore = 0;

  for (const node of APQC_NODES) {
    if (!node.keywords || node.keywords.length === 0) continue;
    let score = 0;
    for (const kw of node.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 1 + kw.length / 20;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestScore > 0 ? bestNode : null;
}

// ─── Blueprint / deviation logic ──────────────────────────────────────────────

/**
 * Compute a structural fingerprint from a parsed process object.
 */
export function getStructuralFingerprint(parsed) {
  const activityNames = (parsed.activities || []).map(a => a.name.toLowerCase()).sort();
  const roleNames     = (parsed.roles     || []).map(r => r.name.toLowerCase()).sort();
  const gatewayTypes  = (parsed.gateways  || []).map(g => g.type).sort();

  return {
    activityNames,
    activityCount:     activityNames.length,
    roleNames,
    roleCount:         roleNames.length,
    gatewayTypes,
    gatewayCount:      gatewayTypes.length,
    eventCount:        (parsed.events         || []).length,
    sequenceFlowCount: (parsed.sequence_flows || []).length,
  };
}

/**
 * Token-overlap ratio between two string arrays (0 = no overlap, 1 = identical).
 */
function nameOverlap(listA, listB) {
  if (!listA.length && !listB.length) return 1;
  if (!listA.length || !listB.length) return 0;
  const setA = new Set(listA.flatMap(s => s.split(/\s+/).filter(t => t.length > 2)));
  const setB = new Set(listB.flatMap(s => s.split(/\s+/).filter(t => t.length > 2)));
  let matches = 0;
  for (const t of setA) { if (setB.has(t)) matches++; }
  return matches / Math.max(setA.size, setB.size);
}

/**
 * Count delta ratio: how far apart are the two counts (0 = same, 1 = completely different).
 */
function countDelta(a, b) {
  const max = Math.max(a, b, 1);
  return Math.min(Math.abs(a - b) / max, 1);
}

/**
 * Compute deviation score (0–1) between a blueprint fingerprint and a parsed process.
 * 0 = identical to blueprint, 1 = completely different.
 */
export function computeDeviationScore(blueprintFingerprint, parsedCurrent) {
  const curr = getStructuralFingerprint(parsedCurrent);

  const nameDelta     = 1 - nameOverlap(blueprintFingerprint.activityNames, curr.activityNames);
  const actCountDelta = countDelta(blueprintFingerprint.activityCount, curr.activityCount);
  const gwCountDelta  = countDelta(blueprintFingerprint.gatewayCount,  curr.gatewayCount);
  const roleCountDelta = countDelta(blueprintFingerprint.roleCount,    curr.roleCount);

  return (
    0.50 * nameDelta +
    0.25 * actCountDelta +
    0.15 * gwCountDelta +
    0.10 * roleCountDelta
  );
}

function deviationLabel(score) {
  if (score < THRESHOLD_NEAR)       return 'near-blueprint';
  if (score < THRESHOLD_CONFIGURED) return 'configured';
  return 'heavily-customised';
}

/**
 * Return the stored blueprint process for a given APQC node, or null.
 */
export function getBlueprintForNode(apqcNodeId) {
  if (!apqcNodeId) return null;
  return readDb().processes.find(
    p => p.apqcNodeId === apqcNodeId && p.processType === 'blueprint'
  ) ?? null;
}

// ─── Save ────────────────────────────────────────────────────────────────────

/**
 * Save a parsed process to the DB.
 *
 * @param {object} parsed          — BPMN parsed JSON
 * @param {object} processContext  — { apqcNodeId, apqcNodeName, isCustom, customLabel }
 * @param {'blueprint'|'configured'|'auto'} saveMode
 *   'auto': becomes blueprint if none exists for the node, otherwise configured.
 *
 * @returns {string} processId
 */
export function saveProcess(parsed, processContext = {}, saveMode = 'auto') {
  const db = readDb();
  const processId = uid();

  const {
    apqcNodeId   = null,
    apqcNodeName = null,
    isCustom     = false,
    customLabel  = null,
  } = processContext;

  // Determine processType
  let processType = 'unclassified';
  let deviationScore = null;
  let devLabel = null;
  let blueprintRefId = null;
  const fingerprint = getStructuralFingerprint(parsed);

  if (!isCustom && apqcNodeId) {
    const existing = getBlueprintForNode(apqcNodeId);

    if (saveMode === 'blueprint') {
      processType = 'blueprint';
    } else if (saveMode === 'configured') {
      processType = 'configured';
      if (existing) {
        deviationScore = computeDeviationScore(existing.fingerprint, parsed);
        devLabel = deviationLabel(deviationScore);
        blueprintRefId = existing.id;
      }
    } else {
      // auto
      if (!existing) {
        processType = 'blueprint';
      } else {
        processType = 'configured';
        deviationScore = computeDeviationScore(existing.fingerprint, parsed);
        devLabel = deviationLabel(deviationScore);
        blueprintRefId = existing.id;
      }
    }
  }

  // Auto-map individual elements to APQC nodes
  const elements = [
    ...(parsed.activities || []).map(a => ({
      id: uid(), processId, type: 'activity',
      name: a.name, performer: a.performer || null,
      apqcNodeId: suggestApqcNode(a.name)?.id ?? null,
    })),
    ...(parsed.events || []).map(e => ({
      id: uid(), processId, type: 'event',
      name: e.name, eventType: e.type,
      apqcNodeId: suggestApqcNode(e.name)?.id ?? null,
    })),
    ...(parsed.gateways || []).map(g => ({
      id: uid(), processId, type: 'gateway',
      name: g.name, gatewayType: g.type, apqcNodeId: null,
    })),
    ...(parsed.roles || []).map(r => ({
      id: uid(), processId, type: 'role',
      name: r.name, apqcNodeId: null,
    })),
  ];

  db.processes.push({
    id: processId,
    processName: parsed.process_name,
    savedAt: new Date().toISOString(),
    elementIds: elements.map(e => e.id),
    apqcNodeId,
    apqcNodeName,
    isCustom,
    customLabel,
    processType,
    deviationScore,
    deviationLabel: devLabel,
    blueprintRefId,
    fingerprint,
    snapshot: parsed,
  });

  db.elements.push(...elements);
  writeDb(db);
  return processId;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getAllProcesses() {
  return readDb().processes;
}

export function getAllElements() {
  return readDb().elements;
}

/** Returns elements whose apqcNodeId is this node OR any descendant */
export function getElementsByNode(nodeId) {
  const ids = getDescendantIds(nodeId);
  return readDb().elements.filter(e => ids.has(e.apqcNodeId));
}

/** Re-map an element to a different APQC node */
export function remapElement(elementId, newApqcNodeId) {
  const db = readDb();
  const el = db.elements.find(e => e.id === elementId);
  if (el) { el.apqcNodeId = newApqcNodeId; writeDb(db); }
}

export function deleteProcess(processId) {
  const db = readDb();
  db.elements  = db.elements.filter(e => e.processId !== processId);
  db.processes = db.processes.filter(p => p.id !== processId);
  writeDb(db);
}

export function clearDb() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Direct element count per APQC node (no inheritance).
 */
export function buildElementCountMap() {
  const counts = {};
  for (const el of readDb().elements) {
    if (!el.apqcNodeId) continue;
    counts[el.apqcNodeId] = (counts[el.apqcNodeId] || 0) + 1;
  }
  return counts;
}

/**
 * Cumulative element count per node including all descendants.
 */
export function buildCumulativeCountMap() {
  const direct = buildElementCountMap();
  const cumulative = {};
  for (const node of APQC_NODES) {
    if (cumulative[node.id] !== undefined) continue;
    let total = 0;
    for (const id of getDescendantIds(node.id)) total += direct[id] || 0;
    cumulative[node.id] = total;
  }
  return cumulative;
}

/**
 * Per-node counts broken down by processType: { blueprint, configured, total }
 * Used for the B:1 C:3 badges in the taxonomy tree.
 */
export function buildProcessCountMap() {
  const map = {};
  for (const proc of readDb().processes) {
    if (!proc.apqcNodeId) continue;
    if (!map[proc.apqcNodeId]) map[proc.apqcNodeId] = { blueprint: 0, configured: 0 };
    if (proc.processType === 'blueprint')  map[proc.apqcNodeId].blueprint++;
    if (proc.processType === 'configured') map[proc.apqcNodeId].configured++;
  }
  return map;
}
