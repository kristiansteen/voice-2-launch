#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  AILEAN offline — double-click to start (macOS)
#
#  Stick layout (relative to this script):
#    start-ailean.command   ← this file
#    ailean_server.py
#    app/                   ← offline build of the app
#    runtimes/llamafile     ← language-model runtime
#    runtimes/whisperfile   ← speech-to-text runtime
#    models/llm/*.gguf      ← language model (non-"thinking" models preferred)
#    models/llm-fallback/   ← used only when models/llm/ is empty
#    models/whisper/*.bin   ← Whisper model
#
#  Voice: uses the built-in macOS voices (Danish "Sara" if installed).
#  Optional: a Piper server on port 5000 is used instead when running.
#  Override with env vars: AILEAN_MODEL, AILEAN_WHISPER_MODEL, AILEAN_CTX.
#  Everything binds to 127.0.0.1 — nothing is reachable from the network.
# ─────────────────────────────────────────────────────────────────────────────
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

CTX="${AILEAN_CTX:-32768}"     # context window: long interviews need ≥32K
APP_PORT=4173
PIDS=()

step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; read -r -p "Press Enter to close…"; exit 1; }

cleanup() {
  step "Stopping AILEAN"
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
pick_model() { # models/llm first (non-thinking preferred), then models/llm-fallback
  local m
  m="$(ls "$ROOT"/models/llm/*.gguf 2>/dev/null | grep -vi thinking | head -1)"
  [ -z "$m" ] && m="$(ls "$ROOT"/models/llm/*.gguf 2>/dev/null | head -1)"
  [ -z "$m" ] && m="$(ls "$ROOT"/models/llm-fallback/*.gguf 2>/dev/null | head -1)"
  echo "$m"
}
MODEL="${AILEAN_MODEL:-$(pick_model)}"
WHISPER_MODEL="${AILEAN_WHISPER_MODEL:-$(ls "$ROOT"/models/whisper/*.bin 2>/dev/null | head -1)}"
LLAMAFILE="$ROOT/runtimes/llamafile"
WHISPERFILE="$ROOT/runtimes/whisperfile"

[ -f "$ROOT/app/index.html" ] || fail "App not found in $ROOT/app"
[ -f "$LLAMAFILE" ]           || fail "llamafile not found in $ROOT/runtimes/"
[ -n "$MODEL" ] && [ -f "$MODEL" ] || fail "No .gguf model in $ROOT/models/llm/ or llm-fallback/ — run get-models.command"

# Binaries on a USB stick get quarantined by macOS Gatekeeper.
xattr -dr com.apple.quarantine "$ROOT/runtimes" "$ROOT"/*.command 2>/dev/null
chmod +x "$LLAMAFILE" "$WHISPERFILE" 2>/dev/null

if echo "$MODEL" | grep -qi thinking; then
  warn "$(basename "$MODEL") is a 'thinking' model: it works, but every answer is slow."
  warn "Run get-models.command to add a faster instruct model."
fi

# ── 1. Language model ────────────────────────────────────────────────────────
step "Starting language model: $(basename "$MODEL")"
"$LLAMAFILE" --server --no-webui --host 127.0.0.1 --port 8080 \
  -m "$MODEL" -c "$CTX" -ngl 999 >"$ROOT/logs/llm.log" 2>&1 &
PIDS+=($!)

# ── 2. App server (also runs Whisper and the voice) ──────────────────────────
WHISPER_ARGS=()
if [ -f "$WHISPERFILE" ] && [ -n "$WHISPER_MODEL" ]; then
  WHISPER_ARGS=(--whisper-bin "$WHISPERFILE" --whisper-model "$WHISPER_MODEL")
  step "Speech-to-text: $(basename "$WHISPER_MODEL")"
else
  warn "No Whisper model in models/whisper/ — voice input off (run get-models.command)"
fi
if ! say -v '?' 2>/dev/null | grep -q 'da_DK'; then
  warn "No Danish macOS voice installed. Add one: System Settings → Accessibility"
  warn "→ Spoken Content → System voice → Manage Voices → Danish (Sara)."
fi

step "Starting AILEAN app"
python3 "$ROOT/ailean_server.py" --app "$ROOT/app" --port "$APP_PORT" "${WHISPER_ARGS[@]}" \
  >"$ROOT/logs/app.log" 2>&1 &
PIDS+=($!)
wait_for_port "$APP_PORT" "AILEAN app" 15

step "Loading the model into memory (first start can take a few minutes)…"
wait_for_port 8080 "Language model" 600

open "http://127.0.0.1:$APP_PORT"
printf '\n\033[1;32m✓ AILEAN offline is running at http://127.0.0.1:%s\033[0m\n' "$APP_PORT"
printf '  Keep this window open. Close it (or press Ctrl+C) to stop everything.\n'
wait
