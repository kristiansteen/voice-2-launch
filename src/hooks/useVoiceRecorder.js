import { useState, useRef, useCallback } from 'react';

/**
 * BPMN-domain post-processing.
 * Fixes common speech-to-text errors for business process terminology.
 */
const CORRECTIONS = [
  [/\bgate\s+way\b/gi,        'gateway'],
  [/\bwork\s+flow\b/gi,       'workflow'],
  [/\bsub[\s-]process\b/gi,   'sub-process'],
  [/\bhand\s+off\b/gi,        'handoff'],
  [/\bend[\s-]to[\s-]end\b/gi,'end-to-end'],
  [/\bpurchase\s+order\b/gi,  'purchase order'],
  [/\bpee\s*oh\b/gi,          'PO'],
  [/\bsee\s*are\s*em\b/gi,    'CRM'],
  [/\bee\s*are\s*pee\b/gi,    'ERP'],
  [/\bkay\s*pee\s*eye\b/gi,   'KPI'],
  [/\bsee\s*ell\s*ay\b/gi,    'SLA'],
  [/\bapee\s*eye\b/gi,        'API'],
  [/\bai\b/g,                  'AI'],
  [/\bexclusive\s+gateway\b/gi,'exclusive gateway'],
  [/\bparallel\s+gateway\b/gi, 'parallel gateway'],
  [/\bstart\s+event\b/gi,      'start event'],
  [/\bend\s+event\b/gi,        'end event'],
  [/\buser\s+task\b/gi,        'user task'],
  [/\bservice\s+task\b/gi,     'service task'],
  [/\bsequence\s+flow\b/gi,    'sequence flow'],
  [/\bmessage\s+flow\b/gi,     'message flow'],
  [/\bswim\s*lane\b/gi,        'swimlane'],
  [/\bswim\s*lanes\b/gi,       'swimlanes'],
  [/\bpool\b/gi,               'pool'],
  [/\bstake\s*holder\b/gi,     'stakeholder'],
  [/\bstake\s*holders\b/gi,    'stakeholders'],
  [/\bescalate\b/gi,           'escalate'],
  [/\bescalation\b/gi,         'escalation'],
  [/\bapprove\b/gi,            'approve'],
  [/\bapproval\b/gi,           'approval'],
];

function applyCorrections(text) {
  return CORRECTIONS.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), text);
}

const LANG_MAP = { en: 'en-US', da: 'da-DK' };

export function useVoiceRecorder({ onTranscriptUpdate, lang = 'en' }) {
  const [isRecording, setIsRecording]   = useState(false);
  const [interimText, setInterimText]   = useState('');
  const [error, setError]               = useState(null);
  const [supported, setSupported]       = useState(
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const recognitionRef      = useRef(null);
  const finalTranscriptRef  = useRef('');
  const restartingRef       = useRef(false);

  const start = useCallback((existingTranscript = '') => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    setError(null);
    finalTranscriptRef.current = existingTranscript ? existingTranscript + ' ' : '';

    const recognition = new SR();
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;
    recognition.lang            = LANG_MAP[lang] || 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += applyCorrections(chunk) + ' ';
          onTranscriptUpdate(finalTranscriptRef.current.trimEnd());
        } else {
          interim += chunk;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      // 'no-speech' and 'network' are recoverable — restart silently
      if (['no-speech', 'network'].includes(event.error) && restartingRef.current) return;
      if (event.error === 'aborted') return;
      setError(event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't explicitly stopped (handles browser 60-s timeout)
      if (restartingRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      } else {
        setIsRecording(false);
        setInterimText('');
      }
    };

    restartingRef.current = true;
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }, [lang, onTranscriptUpdate]);

  const stop = useCallback(() => {
    restartingRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
    setInterimText('');
  }, []);

  return { isRecording, interimText, error, supported, start, stop };
}
