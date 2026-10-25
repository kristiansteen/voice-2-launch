#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  AILEAN offline — double-click to start (macOS)
#
#  Expects this layout on the stick (paths are relative to this script):
#    AILEAN/
#    ├── start-ailean.command        ← this file
#    ├── ailean_server.py
#    ├── app/                        ← contents of dist-offline/
#    ├── runtimes/llamafile          ← llamafile binary (or llamafile on PATH)
#    └── models/
#        ├── llm/*.gguf              ← your Qwen model (first .gguf found is used)
#        ├── whisper/ggml-*.bin      ← Whisper model
#        └── piper/da_DK-*.onnx      ← Piper voice
#
#  Override anything with environment variables, e.g. AILEAN_MODEL=/path/x.gguf
#  Everything binds to 127.0.0.1 — nothing is reachable from the network.
# ─────────────────────────────────────────────────────────────────────────────
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

CTX="${AILEAN_CTX:-32768}"     # context window: long interviews need ≥32K
APP_PORT=4173
PIDS=()

say_step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }
fail()     { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; read -r -p "Press Enter to close…"; exit 1; }

cleanup() {
  say_step "Stopping AILEAN"
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

wait_for_port() { # port, name, seconds
  for _ in $(seq 1 "$3"); do
    nc -z 127.0.0.1 "$1" 2>/dev/null && return 0
    sleep 1
  done
  fail "$2 did not start on port $1 — see $ROOT/logs/"
}

mkdir -p "$ROOT/logs"

# ── Find components ──────────────────────────────────────────────────────────
MODEL="${AILEAN_MODEL:-$(ls "$ROOT"/models/llm/*.gguf 2>/dev/null | head -1)}"
WHISPER_MODEL="${AILEAN_WHISPER_MODEL:-$(ls "$ROOT"/models/whisper/ggml-*.bin 2>/dev/null | head -1)}"
PIPER_VOICE="${AILEAN_PIPER_VOICE:-$(ls "$ROOT"/models/piper/*.onnx 2>/dev/null | head -1)}"

LLAMAFILE="${AILEAN_LLAMAFILE:-}"
if [ -z "$LLAMAFILE" ]; then
  for c in "$ROOT"/runtimes/llamafile "$ROOT"/runtimes/llamafile*/llamafile "$ROOT"/llamafile*; do
    [ -f "$c" ] && { LLAMAFILE="$c"; break; }
  done
  [ -z "$LLAMAFILE" ] && LLAMAFILE="$(command -v llamafile || true)"
fi
WHISPER_BIN="$(command -v whisper-server || true)"

[ -f "$ROOT/app/index.html" ] || fail "App not found in $ROOT/app (copy dist-offline/ there)"
[ -n "$MODEL" ] && [ -f "$MODEL" ] || fail "No .gguf model found in $ROOT/models/llm"
[ -n "$LLAMAFILE" ] || fail "llamafile not found (put it in $ROOT/runtimes/)"

# Binaries copied to a USB stick get quarantined by macOS Gatekeeper.
xattr -dr com.apple.quarantine "$ROOT/runtimes" 2>/dev/null
chmod +x "$LLAMAFILE" 2>/dev/null

# ── 1. Language model ────────────────────────────────────────────────────────
say_step "Starting language model: $(basename "$MODEL")"
"$LLAMAFILE" --server --nobrowser --host 127.0.0.1 --port 8080 \
  -m "$MODEL" -c "$CTX" -ngl 999 >"$ROOT/logs/llm.log" 2>&1 &
PIDS+=($!)

# ── 2. Whisper (speech-to-text) ──────────────────────────────────────────────
if [ -n "$WHISPER_BIN" ] && [ -n "$WHISPER_MODEL" ]; then
  say_step "Starting Whisper: $(basename "$WHISPER_MODEL")"
  "$WHISPER_BIN" --host 127.0.0.1 --port 8081 -m "$WHISPER_MODEL" >"$ROOT/logs/whisper.log" 2>&1 &
  PIDS+=($!)
  WHISPER_ON=1
else
  printf '  ! Whisper not found — voice input disabled (paste transcripts instead)\n'
  WHISPER_ON=0
fi

# ── 3. Piper (text-to-speech) ────────────────────────────────────────────────
if [ -n "$PIPER_VOICE" ] && python3 -c "import piper" 2>/dev/null; then
  say_step "Starting Piper voice: $(basename "$PIPER_VOICE" .onnx)"
  python3 -m piper.http_server -m "$PIPER_VOICE" --host 127.0.0.1 --port 5000 \
    >"$ROOT/logs/piper.log" 2>&1 &
  PIDS+=($!)
  PIPER_ON=1
else
  printf '  ! Piper not found — AILEAN interviewer will show questions without voice\n'
  PIPER_ON=0
fi

# ── 4. App server ────────────────────────────────────────────────────────────
say_step "Starting AILEAN app"
python3 "$ROOT/ailean_server.py" --app "$ROOT/app" --port "$APP_PORT" >"$ROOT/logs/app.log" 2>&1 &
PIDS+=($!)

wait_for_port "$APP_PORT" "AILEAN app" 15
[ "$WHISPER_ON" = 1 ] && wait_for_port 8081 "Whisper" 60
[ "$PIPER_ON" = 1 ]   && wait_for_port 5000 "Piper" 60
say_step "Loading the model into memory (first start can take a few minutes)…"
wait_for_port 8080 "Language model" 600

open "http://127.0.0.1:$APP_PORT"
printf '\n\033[1;32m✓ AILEAN offline is running at http://127.0.0.1:%s\033[0m\n' "$APP_PORT"
printf '  Keep this window open. Close it (or press Ctrl+C) to stop everything.\n'
wait
