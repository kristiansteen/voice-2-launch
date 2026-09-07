import { useState, useRef, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import {
  deriveErrorText,
  normalizeMode,
  normalizeStatus,
  turnFromMessage,
  computeEnabled,
  computeThinking,
  buildSessionConfig,
} from '../lib/aileanInterview.js';

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AILEAN_AGENT_ID;

export function useAileanInterviewer(lang = 'en') {
  const langRef = useRef(lang);
  langRef.current = lang; // sync update on every render so toggle() always reads latest

  const [turns, setTurns]       = useState([]);
  const [error, setError]       = useState(null);
  const [mode, setMode]         = useState('disconnected'); // 'disconnected' | 'listening' | 'speaking'
  const [connecting, setConnecting] = useState(false); // true between startSession() and onConnect/onError

  const conversation = useConversation({
    onConnect: () => {
      console.log('[Ailean] onConnect fired — status:', conversation.status);
      setConnecting(false);
      setMode('listening');
      setError(null);
    },
    onDisconnect: () => {
      console.log('[Ailean] onDisconnect fired');
      setConnecting(false);
      setMode('disconnected');
    },
    onMessage: ({ message, source }) => {
      console.log('[Ailean] onMessage', source, message);
      setTurns(prev => [...prev, turnFromMessage({ message, source })]);
    },
    onModeChange: ({ mode: m }) => {
      console.log('[Ailean] onModeChange', m);
      setMode(normalizeMode(m));
    },
    onError: (msg) => {
      const errText = deriveErrorText(msg);
      console.error('[Ailean] onError', errText);
      setConnecting(false);
      setError(errText);
    },
    onStatusChange: (s) => {
      console.log('[Ailean] onStatusChange', s);
      const st = normalizeStatus(s);
      if (st === 'disconnected') {
        setConnecting(false);
        setMode('disconnected');
      } else if (st === 'connected') {
        setConnecting(false);
        setMode('listening');
      }
    },
    onDebug: (info) => {
      console.log('[Ailean debug]', info);
    },
  });

  const sdkConnected = conversation.status === 'connected';
  // Use `mode` as a synchronous override: reset() sets mode='disconnected' immediately,
  // so `enabled` goes false in the same render even before the async onDisconnect fires.
  const enabled      = computeEnabled({ connecting, sdkConnected, mode });
  const speaking     = conversation.isSpeaking;
  const thinking     = computeThinking({ connecting, sdkConnected });

  function toggle() {
    if (enabled) {
      setConnecting(false);
      try { conversation.endSession(); } catch { }
      setError(null);
    } else {
      if (!AGENT_ID) {
        setError('VITE_ELEVENLABS_AILEAN_AGENT_ID is not set');
        return;
      }
      setError(null);
      setConnecting(true);
      try {
        conversation.startSession(buildSessionConfig(AGENT_ID, langRef.current));
      } catch (err) {
        setConnecting(false);
        setError(err?.message || 'Failed to start session');
      }
    }
  }

  function reset() {
    setConnecting(false);
    try { conversation.endSession(); } catch { }
    setTurns([]);
    setError(null);
    setMode('disconnected');
  }

  return {
    enabled,
    toggle,
    speaking,
    thinking,
    isSpeaking: conversation.isSpeaking,
    mode,
    turns,
    error,
    reset,
    status: conversation.status,
  };
}
