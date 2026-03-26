import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Flow-Count');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // ── Auth — verify against vimpl backend ─────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const meRes = await fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) return res.status(401).json({ error: 'Invalid token' });

  const meData = await meRes.json().catch(() => ({}));
  const tier = meData?.user?.subscriptionTier;

  // ── Quota enforcement for trial users ───────────────────────────
  // Trial accounts are limited to 1 non-demo flow. The client sends the
  // current non-demo flow count in X-Flow-Count. Commercial/enterprise
  // users are not subject to this check.
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
