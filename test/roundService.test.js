import test from 'node:test';
import assert from 'node:assert/strict';

import { getInvitation, onTokenRefreshed } from '../src/services/roundService.js';

function stubFetch(responses) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, auth: opts.headers?.Authorization, method: opts.method || 'GET' });
    const r = responses.shift();
    return { ok: r.status < 300, status: r.status, json: async () => r.body };
  };
  return calls;
}

test('an expired access token is refreshed once and the request retried', async () => {
  const calls = stubFetch([
    { status: 401, body: { error: 'Unauthorized' } },
    { status: 200, body: { accessToken: 'fresh' } },
    { status: 200, body: { id: 'r1' } },
  ]);
  let refreshed = null;
  onTokenRefreshed(t => { refreshed = t; });
  const r = await getInvitation('stale', 'abc');
  assert.deepEqual(r, { id: 'r1' });
  assert.match(calls[1].url, /\/api\/v1\/auth\/refresh$/);
  assert.equal(calls[2].auth, 'Bearer fresh');
  assert.equal(refreshed, 'fresh');
});

test('when the refresh fails the 401 is reported, not retried forever', async () => {
  const calls = stubFetch([
    { status: 401, body: { error: 'Unauthorized' } },
    { status: 401, body: {} },
  ]);
  await assert.rejects(getInvitation('stale', 'abc'), err => err.status === 401);
  assert.equal(calls.length, 2);
});
