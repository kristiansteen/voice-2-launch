// ElevenLabs TTS — streaming to blob URL for playback
// Default: Sarah — warm, conversational female voice
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

export async function speakText(text, apiKey, voiceId = DEFAULT_VOICE_ID) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const msg = await response.text().catch(() => String(response.status));
    throw new Error(`ElevenLabs ${response.status}: ${msg}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
