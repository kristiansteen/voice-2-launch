// Client for the AS-IS rounds API (vimpl backend, /api/v1/rounds).
// Errors carry .status (HTTP) and .code ('PLAN_REQUIRED', 'ROUND_CLOSED', 'INVITE_INVALID', …).

import { BACKEND_URL, authHeaders } from '../lib/api.js';

async function call(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BACKEND_URL}/api/v1/rounds${path}`, {
    method,
    headers: authHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code || (res.status === 404 ? 'NOT_FOUND' : null);
    throw err;
  }
  return data;
}

const enc = encodeURIComponent;

// Owner
export const createRound    = (token, round) => call(token, '/', { method: 'POST', body: round });
export const listRounds     = token => call(token, '/');
export const getRound       = (token, id) => call(token, `/${enc(id)}`);
export const closeRound     = (token, id) => call(token, `/${enc(id)}/close`, { method: 'POST' });
export const reopenRound    = (token, id) => call(token, `/${enc(id)}/reopen`, { method: 'POST' });
export const renewRoundLink = (token, id) => call(token, `/${enc(id)}/renew-link`, { method: 'POST' });

// Participant
export const getInvitation = (token, inviteToken) => call(token, `/invite/${enc(inviteToken)}`);
export const saveContribution = (token, inviteToken, { status, contribution }) =>
  call(token, `/invite/${enc(inviteToken)}/contribution`, { method: 'PUT', body: { status, contribution } });
export const withdrawContribution = (token, inviteToken) =>
  call(token, `/invite/${enc(inviteToken)}/contribution`, { method: 'DELETE' });
