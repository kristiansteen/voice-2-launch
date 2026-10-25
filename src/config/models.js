import { OFFLINE } from './offline.js';

// ── Model IDs ─────────────────────────────────────────────────────────────────
// Online: Claude. Sonnet for steps that require strict JSON schema integrity
// (BPMN ID references), Haiku for everything else (~15× cheaper, quality sufficient).
// Offline: the single local model loaded in llamafile — it ignores the name.
export const MODEL_SONNET = OFFLINE ? 'local' : 'claude-sonnet-4-6';
export const MODEL_HAIKU  = OFFLINE ? 'local' : 'claude-haiku-4-5-20251001';
