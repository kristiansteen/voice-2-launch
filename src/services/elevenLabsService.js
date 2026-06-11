const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah

// Calls the server-side /api/tts proxy (ElevenLabs key stays server-side).
export async function speakText(text, token, voiceId = DEFAULT_VOICE_ID) {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!response.ok) {
    const msg = await response.text().catch(() => String(response.status));
    throw new Error(`TTS ${response.status}: ${msg}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
