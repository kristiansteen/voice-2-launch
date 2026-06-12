import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // ── Auth — verify against vimpl backend ─────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const meRes = await fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) return res.status(401).json({ error: 'Invalid token' });
  const me = await meRes.json();

  // ── Forward to Anthropic ────────────────────────────────────────
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { model, system, messages, max_tokens } = req.body;
    const message = await client.messages.create({ model, system, messages, max_tokens });

    // Fire-and-forget usage log
    fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/usage/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-usage-secret': process.env.USAGE_LOG_SECRET || '' },
      body: JSON.stringify({
        userId: me.user?.id,
        provider: 'claude',
        inputTokens: message.usage?.input_tokens,
        outputTokens: message.usage?.output_tokens,
      }),
    }).catch(() => {});

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
