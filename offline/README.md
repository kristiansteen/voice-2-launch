# AILEAN offline (USB stick)

Runs AILEAN with no internet: local model (llamafile), Whisper (speech-to-text) and Piper (voice). The online version is not affected — offline mode only exists in the `build:offline` output.

## Build (from the repo)

```bash
npm run build:offline        # → dist-offline/
```

## Stick layout

```
AILEAN/
├── start-ailean.command     ← double-click to start
├── ailean_server.py
├── app/                     ← contents of dist-offline/
├── get-models.command       ← run once (needs internet)
├── runtimes/llamafile       ← language-model runtime
├── runtimes/whisperfile     ← speech-to-text runtime
├── models/llm/*.gguf        ← Qwen (instruct models preferred over "thinking")
├── models/whisper/*.bin     ← Whisper model
└── vault.hc                 ← encrypted client data (VeraCrypt, optional)
```

Nothing to install on the Mac. Voice uses the built-in macOS voices; add the Danish
voice "Sara" under System Settings → Accessibility → Spoken Content → Manage Voices.

## Rules

- Client data is never synced online. Note: work-in-progress flows are kept in the browser's storage on this Mac, not on the stick. Save exports (BPMN, plans) into the mounted vault, and clear the browser data for 127.0.0.1 after a client engagement.
- The app server sets a Content-Security-Policy that blocks every request except to itself, so even a missed cloud call cannot leave the machine.
- Prove it: turn Wi-Fi off, run LuLu, do a full interview → zero outbound connections.
- The interviewer prompt lives in `src/lib/localInterviewPrompt.js`. Online it lives in the ElevenLabs dashboard — keep the two aligned.
