import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveErrorText,
  normalizeMode,
  normalizeStatus,
  turnFromMessage,
  computeEnabled,
  computeThinking,
  buildSessionConfig,
} from '../src/lib/aileanInterview.js';

test('deriveErrorText', async (t) => {
  await t.test('passes a plain string through', () => {
    assert.equal(deriveErrorText('mic blocked'), 'mic blocked');
  });

  await t.test('reads .message from an Error-like object', () => {
    assert.equal(deriveErrorText(new Error('socket closed')), 'socket closed');
    assert.equal(deriveErrorText({ message: 'boom' }), 'boom');
  });

  await t.test('falls back to a generic message for unusable input', () => {
    assert.equal(deriveErrorText(undefined), 'Connection error');
    assert.equal(deriveErrorText({}), 'Connection error');
    assert.equal(deriveErrorText(null), 'Connection error');
  });
});

test('normalizeMode', async (t) => {
  await t.test('keeps "speaking"', () => {
    assert.equal(normalizeMode('speaking'), 'speaking');
  });

  await t.test('maps anything else to "listening"', () => {
    assert.equal(normalizeMode('listening'), 'listening');
    assert.equal(normalizeMode('idle'), 'listening');
    assert.equal(normalizeMode(undefined), 'listening');
  });
});

test('normalizeStatus', async (t) => {
  await t.test('unwraps a { status } object', () => {
    assert.equal(normalizeStatus({ status: 'connected' }), 'connected');
  });

  await t.test('returns a bare string unchanged', () => {
    assert.equal(normalizeStatus('disconnected'), 'disconnected');
  });
});

test('turnFromMessage', async (t) => {
  await t.test('labels an ai message as an ailean turn', () => {
    assert.deepEqual(
      turnFromMessage({ message: 'What happens next?', source: 'ai' }),
      { type: 'ailean', text: 'What happens next?' },
    );
  });

  await t.test('labels any non-ai source as a user turn', () => {
    assert.deepEqual(
      turnFromMessage({ message: 'We log the ticket', source: 'user' }),
      { type: 'user', text: 'We log the ticket' },
    );
  });
});

test('computeEnabled', async (t) => {
  await t.test('is true while connecting, even before the socket is up', () => {
    assert.equal(computeEnabled({ connecting: true, sdkConnected: false, mode: 'disconnected' }), true);
  });

  await t.test('is true when connected and not reset', () => {
    assert.equal(computeEnabled({ connecting: false, sdkConnected: true, mode: 'listening' }), true);
  });

  await t.test('is false once mode has been reset to disconnected', () => {
    assert.equal(computeEnabled({ connecting: false, sdkConnected: true, mode: 'disconnected' }), false);
  });

  await t.test('is false when idle', () => {
    assert.equal(computeEnabled({ connecting: false, sdkConnected: false, mode: 'disconnected' }), false);
  });
});

test('computeThinking', async (t) => {
  await t.test('is true only while connecting and not yet connected', () => {
    assert.equal(computeThinking({ connecting: true, sdkConnected: false }), true);
  });

  await t.test('is false once connected', () => {
    assert.equal(computeThinking({ connecting: true, sdkConnected: true }), false);
  });

  await t.test('is false when not connecting', () => {
    assert.equal(computeThinking({ connecting: false, sdkConnected: false }), false);
  });
});

test('buildSessionConfig', async (t) => {
  await t.test('carries the agent id, websocket type and language, but never overrides prompt', () => {
    const config = buildSessionConfig('agent_123', 'da');
    assert.equal(config.agentId, 'agent_123');
    assert.equal(config.connectionType, 'websocket');
    assert.equal(config.overrides.agent.language, 'da');
    // The agent's ElevenLabs config doesn't permit a prompt override — sending
    // one causes the platform to reject the whole session (close code 1008).
    assert.equal(config.overrides.agent.prompt, undefined);
  });

  await t.test('threads the language argument through unchanged', () => {
    assert.equal(buildSessionConfig('a', 'en').overrides.agent.language, 'en');
  });
});
