import Anthropic from '@anthropic-ai/sdk';

// ── In-memory JWT validation cache ───────────────────────────────────────────
// Keyed by token, value: { tier, expiresAt }. Cuts one round-trip to the vimpl
// backend per pipeline step after the first call in a session.
const AUTH_CACHE_TTL_MS = 60_000;
const authCache = new Map();

async function validateToken(token) {
  const now = Date.now();
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > now) return cached.tier;

  const meRes = await fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    authCache.delete(token);
    return null; // invalid
  }

  const meData = await meRes.json().catch(() => ({}));
  const tier = meData?.user?.subscriptionTier ?? 'trial';
  authCache.set(token, { tier, expiresAt: now + AUTH_CACHE_TTL_MS });
  return tier;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Flow-Count');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // ── Auth — verify against vimpl backend (cached 60s) ────────────
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const tier = await validateToken(token);
  if (tier === null) return res.status(401).json({ error: 'Invalid token' });

  // ── Quota enforcement for trial users ───────────────────────────
  if (tier === 'trial') {
    const flowCount = parseInt(req.headers['x-flow-count'] || '0', 10);
    if (flowCount > 1) {
      return res.status(402).json({ error: 'Flow limit reached. Upgrade to create more flows.' });
    }
  }

  // ── Forward to Anthropic ────────────────────────────────────────
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { model, system, messages, max_tokens } = req.body;
    const message = await client.messages.create({ model, system, messages, max_tokens });
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
