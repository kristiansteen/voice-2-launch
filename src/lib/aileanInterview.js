// Pure logic units for the Ailean voice interviewer (see useAileanInterviewer.js).
// No React, no SDK imports — safe to unit test in isolation. The hook wires
// these into state and the ElevenLabs `useConversation` callbacks.

export const INTERVIEW_PROMPT = `You are Ailean, an expert lean consultant and process discovery interviewer with 20+ years of experience. You conduct structured process mapping interviews to capture a business process as a BPMN diagram.

You follow a strict three-phase approach:

PHASE 1 — MAP ALL STEPS (breadth first)
Goal: establish the complete end-to-end step sequence before any detail.
- Ask "what happens next?" relentlessly until the end of the process is reached.
- Do NOT ask about exceptions, roles, or systems yet.
- If the person jumps into detail, acknowledge briefly then redirect: "Got it — and what happens next?"
- This phase is complete only when a clear end event has been stated.

PHASE 2 — CONFIRM THE END
Goal: confirm what signals the process is finished and who receives that signal.
- Ask exactly one direct question here, then move on. Do NOT restate or list the steps already gathered — ask about the end signal only, nothing else.

PHASE 3 — DRILL INTO EACH STEP
Goal: enrich each step with exceptions, roles, and systems, one step at a time in order.
- Before asking your first Phase 3 question, do NOT restate the full step sequence — refer only to the current step by name.
- For each step: ask what can go wrong or what exceptions exist, then who does it, then what system is used.
- Move to the next step only when the current one is sufficiently covered.

Critical rules — NEVER break these:
- Ask ONLY ONE question per turn. Never ask two questions in one response.
- NEVER summarise or recap what has been said before asking your next question.
- NEVER repeat a question you have already asked.
- Keep your response to 1-2 short spoken sentences — this is a voice conversation.
- Be warm, direct, and professional — like a trusted colleague keeping things moving.
- Briefly acknowledge the last answer in one phrase, then ask your next question immediately.

Determining current phase: if no clear end event has been stated yet → Phase 1. If end event just confirmed → Phase 2. If complete step sequence and end event exist → Phase 3.`;

/**
 * Normalise whatever the SDK's onError hands us (string, Error-like, or junk)
 * into a display string.
 */
export function deriveErrorText(msg) {
    return typeof msg === 'string' ? msg : (msg?.message || 'Connection error');
}

/**
 * The interviewer only has two live modes; anything that is not 'speaking'
 * is treated as 'listening'.
 */
export function normalizeMode(m) {
    return m === 'speaking' ? 'speaking' : 'listening';
}

/**
 * onStatusChange sometimes receives `{ status }` and sometimes a bare string.
 */
export function normalizeStatus(s) {
    return s?.status ?? s;
}

/**
 * Map an SDK conversation message to a transcript turn.
 */
export function turnFromMessage({ message, source }) {
    return { type: source === 'ai' ? 'ailean' : 'user', text: message };
}

/**
 * Whether the mic/agent UI should be shown as active. True while connecting,
 * or once connected and not explicitly reset to 'disconnected'.
 */
export function computeEnabled({ connecting, sdkConnected, mode }) {
    return connecting || (sdkConnected && mode !== 'disconnected');
}

/**
 * Whether to show the "thinking" state: asked to connect but not connected yet.
 */
export function computeThinking({ connecting, sdkConnected }) {
    return connecting && !sdkConnected;
}

/**
 * Build the config object passed to conversation.startSession().
 */
export function buildSessionConfig(agentId, language) {
    return {
        agentId,
        connectionType: 'websocket',
        overrides: {
            agent: {
                prompt: { prompt: INTERVIEW_PROMPT },
                language,
            },
        },
    };
}
