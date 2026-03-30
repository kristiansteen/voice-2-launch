const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah

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

  // ── Forward to ElevenLabs ────────────────────────────────────────
  const { text, voiceId = DEFAULT_VOICE_ID } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      }
    );

    if (!elRes.ok) {
      const msg = await elRes.text().catch(() => String(elRes.status));
      return res.status(elRes.status).json({ error: msg });
    }

    const buffer = Buffer.from(await elRes.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);

    // Fire-and-forget usage log — don't await, never fail the request
    fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/usage/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provider: 'elevenlabs', endpoint: 'tts', characters: text.length }),
    }).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
