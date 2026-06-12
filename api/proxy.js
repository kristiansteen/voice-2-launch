import Anthropic from '@anthropic-ai/sdk';
import { verifyToken, logUsage } from './_auth.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const me = await verifyToken(req, res);
  if (!me) return;

  try {
    const { model, system, messages, max_tokens } = req.body;
    const message = await client.messages.create({ model, system, messages, max_tokens });

    logUsage(me.user?.id, 'claude', {
      inputTokens: message.usage?.input_tokens,
      outputTokens: message.usage?.output_tokens,
    });

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
