import { useState, useRef, useCallback } from 'react';
import { getInterviewFollowUp } from '../services/anthropicService.js';
import { speakText } from '../services/elevenLabsService.js';

// Speak using the browser's built-in TTS as a fallback (no ElevenLabs key).
// Tries to select a natural-sounding female voice if available.
function speakBrowser(text) {
  return new Promise(resolve => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1.05;
    utt.onend = resolve;
    utt.onerror = resolve;

    const voices = window.speechSynthesis.getVoices();
    const preferred = ['Samantha', 'Karen', 'Victoria', 'Moira', 'Female'];
    const voice = voices.find(v => preferred.some(p => v.name.includes(p)))
      || voices.find(v => v.lang.startsWith('en'));
    if (voice) utt.voice = voice;

    window.speechSynthesis.speak(utt);
  });
}

export function useAileanInterviewer({ apiKey, processContext, proxyAuth = null }) {
  const [enabled, setEnabled]           = useState(false);
  const [thinking, setThinking]         = useState(false);
  const [speaking, setSpeaking]         = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questions, setQuestions]       = useState([]);
  const [error, setError]               = useState(null);
  const [turns, setTurns]               = useState([]); // structured conversation turns
  const [prevTranscriptLength, setPrevTranscriptLength] = useState(0);

  const historyRef              = useRef([]);   // last N turns sent to Claude
  const audioRef                = useRef(null); // current Audio element
  const lastTranscriptRef       = useRef('');   // last transcript we acted on
  const prevTranscriptLenRef    = useRef(0);    // length of transcript at last Ailean question

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const askFollowUp = useCallback(async (transcript) => {
    if (!enabled || (!apiKey && !proxyAuth)) return;
    if (thinking || speaking) return;
    if (!transcript || transcript.trim().length < 40) return;
    // Skip if transcript hasn't grown meaningfully since last call
    if (transcript === lastTranscriptRef.current) return;
    lastTranscriptRef.current = transcript;

    setThinking(true);
    setError(null);

    // Capture the user's speech since the last Ailean question
    const userText = transcript.slice(prevTranscriptLenRef.current).trim();

    try {
      const question = await getInterviewFollowUp(
        transcript,
        historyRef.current,
        apiKey,
        processContext,
        proxyAuth,
      );

      setCurrentQuestion(question);
      setQuestions(prev => [...prev, question]);

      // Add user turn + Ailean question to structured conversation
      setTurns(prev => [
        ...prev,
        ...(userText ? [{ type: 'user', text: userText }] : []),
        { type: 'ailean', text: question },
      ]);

      // Update transcript position marker
      prevTranscriptLenRef.current = transcript.length;
      setPrevTranscriptLength(transcript.length);

      // Keep last 6 turns (12 messages) to stay within context
      historyRef.current = [
        ...historyRef.current.slice(-12),
        { role: 'user',      content: `Transcript so far:\n${transcript}` },
        { role: 'assistant', content: question },
      ];

      setThinking(false);
      setSpeaking(true);

      if (proxyAuth?.token) {
        try {
          const url = await speakText(question, proxyAuth.token);
          const audio = new Audio(url);
          audioRef.current = audio;
          await new Promise(resolve => {
            audio.onended = resolve;
            audio.onerror = resolve;
            audio.play().catch(resolve);
          });
          URL.revokeObjectURL(url);
          audioRef.current = null;
        } catch {
          // Fall back to browser TTS if ElevenLabs proxy fails
          await speakBrowser(question);
        }
      } else {
        await speakBrowser(question);
      }
    } catch (err) {
      setError(err.message);
      setThinking(false);
    } finally {
      setSpeaking(false);
    }
  }, [enabled, apiKey, thinking, speaking, processContext, proxyAuth]);

  function toggle() {
    setEnabled(prev => {
      if (prev) stopSpeaking();
      return !prev;
    });
    setError(null);
  }

  function reset() {
    stopSpeaking();
    historyRef.current = [];
    lastTranscriptRef.current = '';
    prevTranscriptLenRef.current = 0;
    setCurrentQuestion(null);
    setQuestions([]);
    setTurns([]);
    setPrevTranscriptLength(0);
    setThinking(false);
    setError(null);
  }

  return {
    enabled, toggle,
    thinking, speaking,
    currentQuestion, questions,
    turns, prevTranscriptLength,
    error,
    askFollowUp, stopSpeaking, reset,
  };
}
