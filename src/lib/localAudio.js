// ── Local audio (offline mode) ────────────────────────────────────────────────
// Microphone capture with simple voice-activity detection, WAV encoding,
// and calls to the local Whisper (speech-to-text) and Piper (text-to-speech)
// servers. Nothing here touches the internet.

import { LOCAL_ENDPOINTS } from '../config/offline.js';

export const SAMPLE_RATE = 16000; // what Whisper expects

// ── WAV encoding ──────────────────────────────────────────────────────────────

/** Downsample Float32 PCM from `fromRate` to `toRate` (simple averaging). */
export function downsample(samples, fromRate, toRate = SAMPLE_RATE) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), samples.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

/** Encode mono Float32 PCM as a 16-bit WAV ArrayBuffer. */
export function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function concat(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

// ── Voice-activity segmenter (pure logic, unit-tested) ────────────────────────
// Feed it audio frames; it decides when a phrase ends (short pause → onSegment)
// and when the speaker's turn ends (long pause after speech → onTurnEnd).

export function createSegmenter({
  sampleRate,
  threshold = 0.012,     // RMS above this counts as speech
  segmentPauseMs = 700,  // pause that closes a phrase
  turnPauseMs = null,    // pause that ends the turn (null = never)
  minSpeechMs = 300,     // ignore clicks / coughs shorter than this
  maxSegmentMs = 20000,  // force a cut on very long phrases
  onSegment,             // (Float32Array at original rate) => void
  onTurnEnd,             // () => void
}) {
  let chunks = [];
  let speechMs = 0;
  let segmentMs = 0;
  let silenceMs = 0;
  let hadSpeechInTurn = false;

  function flush() {
    if (chunks.length && speechMs >= minSpeechMs) onSegment?.(concat(chunks));
    chunks = []; speechMs = 0; segmentMs = 0;
  }

  return {
    push(frame) {
      const ms = (frame.length / sampleRate) * 1000;
      const speaking = rms(frame) > threshold;
      if (speaking) {
        silenceMs = 0;
        speechMs += ms;
        hadSpeechInTurn = true;
        chunks.push(frame);
        segmentMs += ms;
      } else {
        silenceMs += ms;
        if (chunks.length) { chunks.push(frame); segmentMs += ms; }
        if (chunks.length && silenceMs >= segmentPauseMs) flush();
        if (turnPauseMs && hadSpeechInTurn && silenceMs >= turnPauseMs) {
          flush();
          hadSpeechInTurn = false;
          onTurnEnd?.();
        }
      }
      if (segmentMs >= maxSegmentMs) flush();
    },
    flush,
    reset() { chunks = []; speechMs = 0; segmentMs = 0; silenceMs = 0; hadSpeechInTurn = false; },
  };
}

// ── Microphone ────────────────────────────────────────────────────────────────

/**
 * Open the microphone and feed frames to a segmenter.
 * Returns { stop, pause, resume }. Segments arrive as 16 kHz WAV Blobs.
 */
export async function openMic({ onSegment, onTurnEnd, turnPauseMs = null, onLevel }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  let paused = false;

  const seg = createSegmenter({
    sampleRate: ctx.sampleRate,
    turnPauseMs,
    onSegment: (pcm) => {
      const wav = encodeWav(downsample(pcm, ctx.sampleRate));
      onSegment?.(new Blob([wav], { type: 'audio/wav' }));
    },
    onTurnEnd,
  });

  processor.onaudioprocess = (e) => {
    if (paused) return;
    const frame = new Float32Array(e.inputBuffer.getChannelData(0));
    onLevel?.(rms(frame));
    seg.push(frame);
  };
  source.connect(processor);
  processor.connect(ctx.destination);

  return {
    stop() {
      seg.flush();
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(t => t.stop());
      ctx.close().catch(() => {});
    },
    pause() { paused = true; seg.reset(); },
    resume() { seg.reset(); paused = false; },
  };
}

// ── Whisper (speech-to-text) ──────────────────────────────────────────────────

export async function transcribe(wavBlob, lang = 'en') {
  const form = new FormData();
  form.append('file', wavBlob, 'audio.wav');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('language', lang === 'da' ? 'da' : 'en');
  const res = await fetch(LOCAL_ENDPOINTS.stt, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Speech-to-text error ${res.status}`);
  const data = await res.json();
  return cleanWhisperText(data?.text);
}

/** Drop Whisper's non-speech markers and common silence hallucinations. */
export function cleanWhisperText(text) {
  const t = String(text || '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')   // [BLANK_AUDIO], (music) …
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(tak(\s+for(\s+i\s+dag|\s+at\s+se\s+med)?)?|thank you\.?|thanks for watching\.?|undertekster.*)[.!]?$/i.test(t)) return '';
  return t;
}

// ── Piper (text-to-speech) ────────────────────────────────────────────────────

let currentAudio = null;

/** Speak text with the local Piper voice. Resolves when playback ends. */
export async function speak(text) {
  const res = await fetch(LOCAL_ENDPOINTS.tts, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Text-to-speech error ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  return new Promise((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;
    const done = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; resolve(); };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

export function stopSpeaking() {
  if (currentAudio) { currentAudio.pause(); currentAudio.onended?.(); }
}
