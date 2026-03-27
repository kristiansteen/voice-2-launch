import { useState, useRef } from 'react';

export default function SamtalePanel({ offer, updateOffer, setStep, token }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const interviewText = offer.interviewText;

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        transcribeAudio(new Blob(chunksRef.current, { type: 'audio/webm' }));
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Kunne ikke få adgang til mikrofonen. Kontroller tilladelser.');
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function transcribeAudio(blob) {
    setTranscribing(true);
    try {
      // Use browser's SpeechRecognition via a fresh recording session
      // Since we have audio blob, use Web Speech API on a new session or
      // just append a placeholder — for production use Whisper via backend
      // For now, we use the Web Speech API approach via live recording
      setError('Lyd optaget! Kopier teksten manuelt, eller brug tekst-input nedenfor.');
    } catch {
      setError('Transskribering mislykkedes.');
    } finally {
      setTranscribing(false);
    }
  }

  function useSpeechRecognition() {
    setError('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Din browser understøtter ikke taleregistrering. Brug tekst-input.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'da-DK';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = interviewText ? interviewText + '\n' : '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      updateOffer({ interviewText: finalTranscript + interim });
    };

    recognition.onerror = (e) => {
      if (e.error !== 'aborted') setError(`Talegenkendelse fejl: ${e.error}`);
    };

    recognition.onend = () => setRecording(false);

    recognition.start();
    mediaRef.current = recognition;
    setRecording(true);
  }

  function stopSpeech() {
    mediaRef.current?.stop?.();
    setRecording(false);
  }

  function handleNext() {
    if (!interviewText.trim()) {
      setError('Beskriv venligst arbejdet, der skal udføres.');
      return;
    }
    setStep(1);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Kundesamtale</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Beskriv eller optag hvad kunden ønsker — brug dine egne ord.
        </p>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          {error}
        </div>
      )}

      {/* Voice buttons */}
      <div className="flex gap-2 mb-3">
        {!recording ? (
          <button
            onClick={useSpeechRecognition}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B4F72] text-white rounded-lg text-sm font-medium hover:bg-[#154060] transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z"/>
            </svg>
            Optag stemme (da)
          </button>
        ) : (
          <button
            onClick={stopSpeech}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors animate-pulse"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
            Stop optagelse
          </button>
        )}
        <button
          onClick={() => updateOffer({ interviewText: '' })}
          className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Ryd
        </button>
      </div>

      {/* Text area */}
      <textarea
        value={interviewText}
        onChange={e => updateOffer({ interviewText: e.target.value })}
        placeholder="Beskriv hvad kunden ønsker lavet...

Eksempel: Kunden ønsker udskiftning af 12 stikkontakter i stuen og 2 nye lampeudtag i soveværelset. Ejendommen er fra 1975. Kunden har fliser der skal bevares. Ønsker arbejdet udført i uge 3."
        className="flex-1 border border-gray-200 rounded-xl p-4 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#1B4F72] min-h-[200px]"
      />

      {transcribing && (
        <p className="text-xs text-gray-400 mt-1">Behandler lyd...</p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleNext}
          disabled={!interviewText.trim()}
          className="px-6 py-2.5 bg-[#1B4F72] text-white rounded-xl text-sm font-semibold hover:bg-[#154060] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Generer jobbeskrivelse
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
