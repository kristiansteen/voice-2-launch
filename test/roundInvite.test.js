import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INVITE_PARAM, inviteUrl, readInviteFromSearch, rememberInvite, takePendingInvite,
  scopeContextMessage, statusCounts,
} from '../src/lib/roundInvite.js';

function fakeStorage() {
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
  };
}

const ROUND = { processName: 'Invoice approval', startTrigger: 'Invoice received', endPoint: 'Invoice paid' };

test('inviteUrl and readInviteFromSearch round-trip the token', () => {
  assert.equal(INVITE_PARAM, 'round');
  const url = inviteUrl('https://app.ailean.dk', 'abc_-123');
  assert.equal(url, 'https://app.ailean.dk/?round=abc_-123');
  assert.equal(readInviteFromSearch(new URL(url).search), 'abc_-123');
});

test('readInviteFromSearch ignores other parameters', () => {
  assert.equal(readInviteFromSearch('?token=1'), null);
  assert.equal(readInviteFromSearch(''), null);
  assert.equal(readInviteFromSearch('?round='), null);
});

test('a remembered invite survives the login redirect and is taken once', () => {
  const s = fakeStorage();
  rememberInvite(s, 'abc');
  assert.equal(takePendingInvite(s), 'abc');
  assert.equal(takePendingInvite(s), null);
});

test('takePendingInvite tolerates storage that throws', () => {
  const broken = { getItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(takePendingInvite(broken), null);
});

test('scopeContextMessage names the process, start and end', async (t) => {
  await t.test('English', () => {
    const m = scopeContextMessage(ROUND, 'en');
    for (const s of ['Invoice approval', 'Invoice received', 'Invoice paid']) assert.match(m, new RegExp(s));
  });
  await t.test('Danish', () => {
    const m = scopeContextMessage(ROUND, 'da');
    for (const s of ['Invoice approval', 'Invoice received', 'Invoice paid', 'slutter']) assert.match(m, new RegExp(s));
  });
});

test('statusCounts counts each status', () => {
  assert.deepEqual(
    statusCounts([{ status: 'opened' }, { status: 'started' }, { status: 'submitted' }, { status: 'submitted' }]),
    { opened: 1, started: 1, submitted: 2 }
  );
  assert.deepEqual(statusCounts(undefined), { opened: 0, started: 0, submitted: 0 });
});

test('a held invite survives a reload until it is released', async () => {
  const { holdInvite, heldInvite, releaseInvite } = await import('../src/lib/roundInvite.js');
  const s = fakeStorage();
  holdInvite(s, 'abc');
  assert.equal(heldInvite(s), 'abc');
  assert.equal(heldInvite(s), 'abc'); // reading does not consume it
  releaseInvite(s);
  assert.equal(heldInvite(s), null);
});

test('classifyRoundError separates fatal from transient errors', async () => {
  const { classifyRoundError } = await import('../src/lib/roundInvite.js');
  const e = (status, code) => Object.assign(new Error('x'), { status, code });
  assert.equal(classifyRoundError(e(404, 'INVITE_INVALID')), 'invalid');
  assert.equal(classifyRoundError(e(404, 'NOT_FOUND')), 'invalid');
  assert.equal(classifyRoundError(e(409, 'ROUND_CLOSED')), 'closed');
  assert.equal(classifyRoundError(e(401)), 'auth');
  assert.equal(classifyRoundError(e(500)), 'transient');
  assert.equal(classifyRoundError(new TypeError('Failed to fetch')), 'transient');
});
