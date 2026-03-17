import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-nonce');
  res.setHeader('Access-Control-Expose-Headers', 'x-session-nonce, x-session-created');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // ── Auth — verify against vimpl backend ─────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const meRes = await fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) return res.status(401).json({ error: 'Invalid token' });
  const { user } = await meRes.json();
  const userId = user.id;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  );

  // ── Mark session complete with board_id ─────────────────────────
  const { _complete, board_id, board_url } = req.body || {};
  if (_complete && board_id) {
    const clientNonce = req.headers['x-session-nonce'];
    await supabase
      .from('free_sessions')
      .update({ board_id, board_url: board_url || null })
      .eq('user_id', userId)
      .eq('session_nonce', clientNonce);
    return res.status(200).json({ ok: true });
  }

  // ── Session nonce check ─────────────────────────────────────────
  const clientNonce = req.headers['x-session-nonce'];

  const { data: existing } = await supabase
    .from('free_sessions')
    .select('session_nonce, board_id, board_url, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  let sessionNonce;

  if (!existing) {
    // First use — create a session
    const nonce = crypto.randomUUID();
    const { error: insertErr } = await supabase
      .from('free_sessions')
      .insert({ user_id: userId, session_nonce: nonce });
    if (insertErr) return res.status(500).json({ error: 'Failed to create session' });
    sessionNonce = nonce;
  } else if (clientNonce && existing.session_nonce === clientNonce) {
    // Continuing a valid existing session
    sessionNonce = clientNonce;
    res.setHeader('x-session-created', existing.created_at);
  } else {
    // Already used in a different session
    return res.status(403).json({
      error: 'free_session_used',
      board_id: existing.board_id || null,
      board_url: existing.board_url || null,
      created_at: existing.created_at,
    });
  }

  // ── Forward to Anthropic ────────────────────────────────────────
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { model, system, messages, max_tokens } = req.body;

    const message = await client.messages.create({ model, system, messages, max_tokens });

    res.setHeader('x-session-nonce', sessionNonce);
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
