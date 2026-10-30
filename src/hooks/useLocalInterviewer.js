import { useState, useRef, useEffect } from 'react';
import { makeLocalClient } from '../services/localLlm.js';
import { openMic, transcribe, speak, stopSpeaking } from '../lib/localAudio.js';
import { interviewSystemPrompt, openingInstruction } from '../lib/localInterviewPrompt.js';

const END_MARKER = /\[END\]\s*$/i;
const TURN_PAUSE_MS = 2200; // silence that hands the turn back to AILEAN

/** Turns → chat messages (AILEAN = assistant, SME = user). */
export function turnsToMessages(turns, lang) {
  const messages = [{ role: 'user', content: openingInstruction(lang) }];
  for (const t of turns) {
    const role = t.type === 'ailean' ? 'assistant' : 'user';
    const last = messages[messages.length - 1];
    if (last.role === role) last.content += '\n' + t.text; // merge consecutive same-role turns
    else messages.push({ role, content: t.text });
  }
  return messages;
}

/**
 * Offline drop-in for useAileanInterviewer: same return shape, but the
 * conversation loop runs locally — Whisper hears, the local model asks,
 * Piper speaks.
 */
export function useLocalInterviewer(lang = 'en') {
  const langRef = useRef(lang);
  langRef.current = lang;

  const [turns, setTurns]       = useState([]);
  const [error, setError]       = useState(null);
  const [mode, setMode]         = useState('disconnected'); // 'disconnected' | 'listening' | 'speaking'
  const [thinking, setThinking] = useState(false);

  const activeRef  = useRef(false);
  const micRef     = useRef(null);
  const turnsRef   = useRef([]);
  const queueRef   = useRef(Promise.resolve());
  const userTurnIx = useRef(-1); // index of the SME turn currently being spoken

  function commitTurns(next) { turnsRef.current = next; setTurns(next); }

  async function aileanSpeaks() {
    if (!activeRef.current) return;
    setThinking(true);
    micRef.current?.pause();
    try {
      const client = makeLocalClient();
      const res = await client.messages.create({
        max_tokens: 200,
        temperature: 0.5,
        system: interviewSystemPrompt(langRef.current),
        messages: turnsToMessages(turnsRef.current, langRef.current),
      });
      if (!activeRef.current) return;
      const raw = res.content[0].text.trim();
      const finished = END_MARKER.test(raw);
      const question = raw.replace(END_MARKER, '').trim();

      commitTurns([...turnsRef.current, { type: 'ailean', text: question }]);
      userTurnIx.current = -1;
      setThinking(false);
      setMode('speaking');
      try { await speak(question, langRef.current); } catch (e) { setError(e.message); } // keep going without voice

      if (!activeRef.current) return;
      if (finished) { stopSession(); return; }
      setMode('listening');
      micRef.current?.resume();
    } catch (e) {
      setThinking(false);
      setError(e.message);
      if (activeRef.current) { setMode('listening'); micRef.current?.resume(); }
    }
  }

  function onSegment(wav) {
    queueRef.current = queueRef.current.then(async () => {
      try {
        const text = await transcribe(wav, langRef.current);
        if (!text || !activeRef.current) return;
        const next = [...turnsRef.current];
        if (userTurnIx.current >= 0) {
          next[userTurnIx.current] = { ...next[userTurnIx.current], text: next[userTurnIx.current].text + ' ' + text };
        } else {
          userTurnIx.current = next.length;
          next.push({ type: 'user', text });
        }
        commitTurns(next);
      } catch (e) {
        setError(e.message);
      }
    });
  }

  function onTurnEnd() {
    // Wait for the last phrase to be transcribed, then let AILEAN respond.
    queueRef.current = queueRef.current.then(() => {
      if (activeRef.current && userTurnIx.current >= 0) return aileanSpeaks();
    });
  }

  async function startSession() {
    setError(null);
    setThinking(true);
    activeRef.current = true;
    try {
      micRef.current = await openMic({ onSegment, onTurnEnd, turnPauseMs: TURN_PAUSE_MS });
      micRef.current.pause();
    } catch (e) {
      activeRef.current = false;
      setThinking(false);
      setError(e?.name === 'NotAllowedError' ? 'Microphone access denied' : (e?.message || 'Microphone error'));
      return;
    }
    setMode('listening');
    await aileanSpeaks();
  }

  function stopSession() {
    activeRef.current = false;
    stopSpeaking();
    micRef.current?.stop();
    micRef.current = null;
    setThinking(false);
    setMode('disconnected');
  }

  useEffect(() => () => { if (activeRef.current) stopSession(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enabled = activeRef.current || mode !== 'disconnected';

  function toggle() {
    if (enabled) stopSession();
    else startSession();
  }

  function reset() {
    stopSession();
    commitTurns([]);
    userTurnIx.current = -1;
    setError(null);
  }

  return {
    enabled,
    toggle,
    speaking: mode === 'speaking',
    thinking,
    isSpeaking: mode === 'speaking',
    mode,
    turns,
    error,
    reset,
    status: mode === 'disconnected' ? 'disconnected' : 'connected',
  };
}
