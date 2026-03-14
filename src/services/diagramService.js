// Diagram storage service — reads vimpl-saas credentials from the same
// localStorage key used by VimplExportModal so the user only configures once.

const CREDS_KEY = 'voice2bpmn_vimpl_config';

function getCreds() {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY) || '{}');
  } catch { return {}; }
}

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function requireCreds() {
  const { baseUrl, token } = getCreds();
  if (!baseUrl || !token) {
    throw new Error('No vimpl-saas credentials found. Open the Export modal and save your URL + token first.');
  }
  return { baseUrl, token };
}

export async function saveDiagram(name, xml, processName) {
  const { baseUrl, token } = requireCreds();
  const res = await fetch(`${baseUrl}/api/v1/diagrams`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, xml, processName: processName || null }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Save failed (${res.status})`);
  }
  return res.json(); // { id, name, processName, createdAt, updatedAt }
}

export async function updateDiagram(id, name, xml, processName) {
  const { baseUrl, token } = requireCreds();
  const res = await fetch(`${baseUrl}/api/v1/diagrams/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ name, xml, processName: processName || null }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Update failed (${res.status})`);
  }
  return res.json();
}

export async function listDiagrams() {
  const { baseUrl, token } = requireCreds();
  const res = await fetch(`${baseUrl}/api/v1/diagrams`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `List failed (${res.status})`);
  }
  return res.json(); // [{ id, name, processName, updatedAt }]
}

export async function loadDiagram(id) {
  const { baseUrl, token } = requireCreds();
  const res = await fetch(`${baseUrl}/api/v1/diagrams/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Load failed (${res.status})`);
  }
  return res.json(); // { id, name, xml, processName, ... }
}

export async function deleteDiagram(id) {
  const { baseUrl, token } = requireCreds();
  const res = await fetch(`${baseUrl}/api/v1/diagrams/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Delete failed (${res.status})`);
  }
}
