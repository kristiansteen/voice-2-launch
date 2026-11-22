// Client for the AS-IS rounds API (vimpl backend, /api/v1/rounds).
// Errors carry .status (HTTP) and .code ('PLAN_REQUIRED', 'ROUND_CLOSED', 'INVITE_INVALID', …).

import { BACKEND_URL, authHeaders } from '../lib/api.js';

// Access tokens are short-lived, and an interview can outlast one. On a 401 the
// token is refreshed once from the refresh cookie and the request retried; the
// app is told the new token so the rest of it keeps working.
let tokenListener = null;
export function onTokenRefreshed(fn) { tokenListener = fn; }

async function refreshAccessToken() {
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.accessToken) tokenListener?.(data.accessToken);
  return data?.accessToken || null;
}

async function call(token, path, { method = 'GET', body } = {}) {
  const send = t => fetch(`${BACKEND_URL}/api/v1/rounds${path}`, {
    method,
    headers: authHeaders(t),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let res = await send(token);
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code || (res.status === 404 ? 'NOT_FOUND' : null);
    err.data = data;
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

// Sharing a flow: the round that collects descriptions of it, and email invitations
export const getRoundForFlow = (token, flowId) => call(token, `/by-flow/${enc(flowId)}`);
export const startRoundForFlow = (token, { flowId, processName, startTrigger, endPoint, language }) =>
  call(token, '/from-flow', { method: 'POST', body: { flowId, processName, startTrigger, endPoint, language } });
export const linkRoundToFlow = (token, id, flowId) => call(token, `/${enc(id)}/link`, { method: 'POST', body: { flowId } });
export const sendInvites = (token, id, { emails, note }) => call(token, `/${enc(id)}/invites`, { method: 'POST', body: { emails, note } });
export const remindInvites = (token, id) => call(token, `/${enc(id)}/remind`, { method: 'POST' });
export const removeInvite = (token, id, inviteId) => call(token, `/${enc(id)}/invites/${enc(inviteId)}`, { method: 'DELETE' });
