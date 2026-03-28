import Anthropic from '@anthropic-ai/sdk';

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
    return null;
  }

  const meData = await meRes.json().catch(() => ({}));
  const tier = meData?.user?.subscriptionTier ?? 'student';
  authCache.set(token, { tier, expiresAt: now + AUTH_CACHE_TTL_MS });
  return tier;
}

async function checkUsageLimit(token) {
  try {
    const res = await fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/usage/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: 'aison' }),
    });
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      return { allowed: false, message: body.message || 'Daglig grænse nået.' };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Ikke autoriseret' });

  const tier = await validateToken(token);
  if (tier === null) return res.status(401).json({ error: 'Ugyldigt token' });

  const usage = await checkUsageLimit(token);
  if (!usage.allowed) return res.status(429).json({ error: usage.message });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { model, system, messages, max_tokens } = req.body;
    const message = await client.messages.create({ model, system, messages, max_tokens });
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
