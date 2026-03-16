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

export function useAileanInterviewer({ apiKey, elevenLabsKey, processContext }) {
  const [enabled, setEnabled]           = useState(false);
  const [thinking, setThinking]         = useState(false);
  const [speaking, setSpeaking]         = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questions, setQuestions]       = useState([]);
  const [error, setError]               = useState(null);

  const historyRef          = useRef([]);   // last N turns sent to Claude
  const audioRef            = useRef(null); // current Audio element
  const lastTranscriptRef   = useRef('');   // last transcript we acted on

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const askFollowUp = useCallback(async (transcript) => {
    if (!enabled || !apiKey) return;
    if (thinking || speaking) return;
    if (!transcript || transcript.trim().length < 40) return;
    // Skip if transcript hasn't grown meaningfully since last call
    if (transcript === lastTranscriptRef.current) return;
    lastTranscriptRef.current = transcript;

    setThinking(true);
    setError(null);

    try {
      const question = await getInterviewFollowUp(
        transcript,
        historyRef.current,
        apiKey,
        processContext,
      );

      setCurrentQuestion(question);
      setQuestions(prev => [...prev, question]);

      // Keep last 3 turns (6 messages) to stay within context
      historyRef.current = [
        ...historyRef.current.slice(-6),
        { role: 'user',      content: `Transcript so far:\n${transcript}` },
        { role: 'assistant', content: question },
      ];

      setThinking(false);
      setSpeaking(true);

      if (elevenLabsKey) {
        const url = await speakText(question, elevenLabsKey);
        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise(resolve => {
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch(resolve);
        });
        URL.revokeObjectURL(url);
        audioRef.current = null;
      } else {
        await speakBrowser(question);
      }
    } catch (err) {
      setError(err.message);
      setThinking(false);
    } finally {
      setSpeaking(false);
    }
  }, [enabled, apiKey, elevenLabsKey, thinking, speaking, processContext]);

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
    setCurrentQuestion(null);
    setQuestions([]);
    setThinking(false);
    setError(null);
  }

  return {
    enabled, toggle,
    thinking, speaking,
    currentQuestion, questions,
    error,
    askFollowUp, stopSpeaking, reset,
  };
}
