// Pure logic units for the Ailean voice interviewer (see useAileanInterviewer.js).
// No React, no SDK imports — safe to unit test in isolation. The hook wires
// these into state and the ElevenLabs `useConversation` callbacks.

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
 *
 * Deliberately does NOT override agent.prompt: this agent's ElevenLabs
 * dashboard config does not have the "prompt" override permission enabled,
 * so the platform rejects the whole session with a 1008 close ("Override
 * for field 'prompt' is not allowed by config") the moment it's sent —
 * killing audio and transcription entirely, not just the custom prompt.
 * The interview script lives in the agent's own system prompt in the
 * ElevenLabs dashboard now — edit it there, not here.
 */
export function buildSessionConfig(agentId, language) {
    return {
        agentId,
        connectionType: 'websocket',
        overrides: {
            agent: {
                language,
            },
        },
    };
}
