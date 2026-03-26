// ── /api/flows — Flow persistence proxy ───────────────────────────────────────
// Validates vimpl JWT, then proxies CRUD to Supabase using the service role key.
// The client never touches Supabase directly — all auth is server-side.
//
// GET    /api/flows           → list all flows for the authenticated user
// POST   /api/flows           → upsert a flow (body: { id, process_name, data })
// DELETE /api/flows?id=<uuid> → delete a flow by id

const SUPABASE_TABLE = 'voice2launch_flows';

function supabaseUrl(path) {
  return `${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`;
}

function supabaseHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function validateVimplToken(token) {
  const res = await fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data?.user ?? null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Auth ──────────────────────────────────────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = await validateVimplToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  const userId = user.id ?? user.email;
  if (!userId) return res.status(401).json({ error: 'Cannot identify user' });

  // ── GET — list flows ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const sbRes = await fetch(
      supabaseUrl(`${SUPABASE_TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=*&order=updated_at.desc`),
      { headers: supabaseHeaders() }
    );
    if (!sbRes.ok) return res.status(502).json({ error: 'Database error' });
    const rows = await sbRes.json();
    // Rehydrate: flatten data blob back into flow shape
    const flows = rows.map(row => ({ ...row.data, id: row.id, process_name: row.process_name, created_at: row.created_at, updated_at: row.updated_at }));
    return res.json(flows);
  }

  // ── POST — upsert flow ────────────────────────────────────────────
  if (req.method === 'POST') {
    const { id, process_name, ...data } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const row = {
      id,
      user_id: userId,
      process_name: process_name || 'New process',
      data,
      updated_at: new Date().toISOString(),
    };

    const sbRes = await fetch(
      supabaseUrl(SUPABASE_TABLE),
      {
        method: 'POST',
        headers: { ...supabaseHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row),
      }
    );
    if (!sbRes.ok) {
      const err = await sbRes.text();
      return res.status(502).json({ error: 'Database error', detail: err });
    }
    return res.status(200).json({ ok: true });
  }

  // ── DELETE — remove flow ──────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const sbRes = await fetch(
      supabaseUrl(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`),
      { method: 'DELETE', headers: supabaseHeaders() }
    );
    if (!sbRes.ok) return res.status(502).json({ error: 'Database error' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
