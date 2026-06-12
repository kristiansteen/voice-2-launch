// Shared helpers for voice-2-launch Vercel proxy functions

/**
 * Verify the Bearer token against the vimpl backend.
 * Returns the parsed `me` object on success, or sends a 401 and returns null.
 */
export async function verifyToken(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const meRes = await fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }

  return meRes.json();
}

/**
 * Fire-and-forget usage log to the vimpl backend.
 */
export function logUsage(userId, provider, data) {
  fetch(`${process.env.VIMPL_BACKEND_URL}/api/v1/usage/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-usage-secret': process.env.USAGE_LOG_SECRET || '',
    },
    body: JSON.stringify({ userId, provider, ...data }),
  }).catch(err => console.error('[usage-log]', err.message));
}
