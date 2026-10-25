import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contentToText, stripReasoning, toOpenAiBody, toAnthropicMessage,
} from '../src/services/localLlm.js';
import {
  createSegmenter, encodeWav, downsample, cleanWhisperText,
} from '../src/lib/localAudio.js';
import { turnsToMessages } from '../src/hooks/useLocalInterviewer.js';

// ── Local LLM adapter ─────────────────────────────────────────────────────────

test('contentToText flattens Anthropic content blocks', () => {
  assert.equal(contentToText('hi'), 'hi');
  assert.equal(contentToText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'a\nb');
  assert.equal(contentToText(null), '');
});

test('stripReasoning removes <think> blocks', () => {
  assert.equal(stripReasoning('<think>hmm</think>\n{"a":1}'), '{"a":1}');
  assert.equal(stripReasoning('reasoning…</think>answer'), 'answer');
  assert.equal(stripReasoning('plain'), 'plain');
});

test('toOpenAiBody maps system + messages + max_tokens', () => {
  const body = toOpenAiBody({
    model: 'local', max_tokens: 500,
    system: 'SYS',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Q' }] }],
  });
  assert.deepEqual(body.messages, [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'Q' }]);
  assert.equal(body.max_tokens, 500);
  assert.equal(body.chat_template_kwargs.enable_thinking, false);
});

test('toAnthropicMessage returns content[0].text like the SDK', () => {
  const msg = toAnthropicMessage({
    choices: [{ message: { content: '<think>x</think>OK' }, finish_reason: 'length' }],
    usage: { prompt_tokens: 10, completion_tokens: 2 },
  });
  assert.equal(msg.content[0].text, 'OK');
  assert.equal(msg.stop_reason, 'max_tokens');
  assert.equal(msg.usage.input_tokens, 10);
});

// ── Audio ─────────────────────────────────────────────────────────────────────

const RATE = 16000;
const frame = (amp, ms = 100) => new Float32Array((RATE * ms) / 1000).fill(amp);

test('segmenter emits a phrase after a short pause, ignores pure silence', () => {
  const segments = [];
  const seg = createSegmenter({ sampleRate: RATE, onSegment: s => segments.push(s) });
  for (let i = 0; i < 10; i++) seg.push(frame(0));    // 1 s silence → nothing
  assert.equal(segments.length, 0);
  for (let i = 0; i < 10; i++) seg.push(frame(0.1));  // 1 s speech
  for (let i = 0; i < 8; i++) seg.push(frame(0));     // 0.8 s pause → phrase closes
  assert.equal(segments.length, 1);
});

test('segmenter ends the turn after a long pause, once', () => {
  let turnEnds = 0;
  const seg = createSegmenter({ sampleRate: RATE, turnPauseMs: 2000, onSegment: () => {}, onTurnEnd: () => turnEnds++ });
  for (let i = 0; i < 10; i++) seg.push(frame(0.1));
  for (let i = 0; i < 30; i++) seg.push(frame(0));    // 3 s silence
  assert.equal(turnEnds, 1);
});

test('segmenter drops blips shorter than minSpeechMs', () => {
  const segments = [];
  const seg = createSegmenter({ sampleRate: RATE, onSegment: s => segments.push(s) });
  seg.push(frame(0.1, 100));                           // 100 ms click
  for (let i = 0; i < 10; i++) seg.push(frame(0));
  assert.equal(segments.length, 0);
});

test('encodeWav writes a valid 16 kHz mono header', () => {
  const buf = encodeWav(new Float32Array(1600));
  const v = new DataView(buf);
  assert.equal(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)), 'RIFF');
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), 16000);
  assert.equal(buf.byteLength, 44 + 3200);
});

test('downsample 48k → 16k keeps duration', () => {
  assert.equal(downsample(new Float32Array(48000), 48000, 16000).length, 16000);
});

test('cleanWhisperText strips markers and silence hallucinations', () => {
  assert.equal(cleanWhisperText('[BLANK_AUDIO]'), '');
  assert.equal(cleanWhisperText(' Tak for i dag. '), '');
  assert.equal(cleanWhisperText('Fakturaen kommer ind (støj) via mail'), 'Fakturaen kommer ind via mail');
});

// ── Interviewer ───────────────────────────────────────────────────────────────

test('turnsToMessages alternates roles and merges consecutive SME turns', () => {
  const msgs = turnsToMessages([
    { type: 'ailean', text: 'Which process?' },
    { type: 'user', text: 'Invoices.' },
    { type: 'user', text: 'Supplier invoices.' },
  ], 'en');
  assert.deepEqual(msgs.map(m => m.role), ['user', 'assistant', 'user']);
  assert.equal(msgs[2].content, 'Invoices.\nSupplier invoices.');
});
