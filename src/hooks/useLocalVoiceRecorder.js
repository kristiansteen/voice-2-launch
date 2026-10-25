import { useState, useRef, useCallback } from 'react';
import { openMic, transcribe } from '../lib/localAudio.js';
import { applyCorrections } from './useVoiceRecorder.js';

/**
 * Offline drop-in for useVoiceRecorder: same return shape, but speech is
 * transcribed by the local Whisper server instead of the browser's speech API
 * (which, in Chrome, sends audio to Google).
 */
export function useLocalVoiceRecorder({ onTranscriptUpdate, lang = 'en' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError]             = useState(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const micRef        = useRef(null);
  const finalRef      = useRef('');
  const queueRef      = useRef(Promise.resolve()); // keeps segments in spoken order
  const pendingRef    = useRef(0);

  const start = useCallback(async (existingTranscript = '') => {
    setError(null);
    finalRef.current = existingTranscript ? existingTranscript + ' ' : '';
    try {
      micRef.current = await openMic({
        onSegment: (wav) => {
          pendingRef.current += 1;
          setInterimText('…');
          queueRef.current = queueRef.current.then(async () => {
            try {
              const text = await transcribe(wav, lang);
              if (text) {
                finalRef.current += applyCorrections(text) + ' ';
                onTranscriptUpdate(finalRef.current.trimEnd());
              }
            } catch (e) {
              setError(e.message);
            } finally {
              pendingRef.current -= 1;
              if (pendingRef.current === 0) setInterimText('');
            }
          });
        },
      });
      setIsRecording(true);
    } catch (e) {
      setError(e?.name === 'NotAllowedError' ? 'not-allowed' : (e?.message || 'Microphone error'));
      setIsRecording(false);
    }
  }, [lang, onTranscriptUpdate]);

  const stop = useCallback(() => {
    micRef.current?.stop();   // flushes the last phrase into the queue
    micRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, interimText, error, supported, start, stop };
}
