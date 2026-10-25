import { BACKEND_URL, authHeaders } from '../lib/api.js';
import { OFFLINE } from '../config/offline.js';

// Offline mode: client data must never leave the machine. These guards make cloud
// sync impossible even if a caller passes a token — flows stay in localStorage only.

export async function fetchFlows(token) {
  if (OFFLINE) return [];
  const res = await fetch(`${BACKEND_URL}/api/v1/flows?app=voice2launch`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch flows');
  return res.json(); // [{ id, name, data, updatedAt, createdAt }]
}

export async function upsertFlow(token, flow) {
  if (OFFLINE) return null;
  const res = await fetch(`${BACKEND_URL}/api/v1/flows/${flow.id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ name: flow.process_name || 'Untitled process', data: flow, appKey: 'voice2launch' }),
  });
  if (res.status === 403) {
    const err = new Error('Flow ID owned by another account');
    err.status = 403;
    throw err;
  }
  if (!res.ok) throw new Error('Failed to save flow');
  return res.json();
}

export async function deleteFlow(token, flowId) {
  if (OFFLINE) return;
  const res = await fetch(`${BACKEND_URL}/api/v1/flows/${flowId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 404) throw new Error('Failed to delete flow');
}
