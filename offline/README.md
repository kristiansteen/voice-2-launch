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
├── runtimes/llamafile       ← llamafile binary
├── models/llm/*.gguf        ← Qwen (first .gguf found is used)
├── models/whisper/ggml-*.bin
├── models/piper/da_DK-*.onnx (+ .onnx.json)
└── vault.hc                 ← encrypted client data (VeraCrypt)
```

## One-time installs on the Mac

```bash
brew install whisper-cpp
python3 -m pip install "piper-tts[http]"
```

## Rules

- Client data is never synced online. Note: work-in-progress flows are kept in the browser's storage on this Mac, not on the stick. Save exports (BPMN, plans) into the mounted vault, and clear the browser data for 127.0.0.1 after a client engagement.
- The app server sets a Content-Security-Policy that blocks every request except to itself, so even a missed cloud call cannot leave the machine.
- Prove it: turn Wi-Fi off, run LuLu, do a full interview → zero outbound connections.
- Piper speaks with one voice (the Danish one). Run interviews in Danish, or add an English voice and restart.
- The interviewer prompt lives in `src/lib/localInterviewPrompt.js`. Online it lives in the ElevenLabs dashboard — keep the two aligned.
