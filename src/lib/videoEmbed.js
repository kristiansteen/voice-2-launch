// Converts a video link a user pastes in (YouTube, Vimeo, Loom, ...) into a
// URL that's safe and embeddable in an <iframe>. Returns null when the input
// is empty, unparsable, or uses a non-http(s) scheme.
export function toEmbedUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

  // YouTube
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    const shorts = parsed.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
    if (parsed.pathname.startsWith('/embed/')) return trimmed;
    return null;
  }
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  // Vimeo
  if (host === 'vimeo.com') {
    const id = parsed.pathname.match(/^\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === 'player.vimeo.com') return trimmed;

  // Loom
  if (host === 'loom.com') {
    const id = parsed.pathname.match(/^\/share\/([\w]+)/)?.[1];
    return id ? `https://www.loom.com/embed/${id}` : trimmed;
  }

  // Unrecognised service — best-effort passthrough; most video hosts serve a
  // directly embeddable page at the URL they hand out for sharing.
  return trimmed;
}
