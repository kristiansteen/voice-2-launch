#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  AILEAN offline — download the models (run once, needs internet)
#
#  1. Whisper large-v3-turbo (q5_0, ~0.6 GB): speech-to-text, good Danish
#  2. Qwen3-4B-Instruct-2507 (Q4_K_M, ~2.5 GB): fast non-thinking model
#
#  Downloads resume if interrupted. Existing files are kept.
# ─────────────────────────────────────────────────────────────────────────────
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/models/whisper" "$ROOT/models/llm"

step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }

# download <dest> <min_bytes> <url> [<url>…] — tries each URL until one works
download() {
  local dest="$1" min="$2"; shift 2
  if [ -f "$dest" ] && [ "$(stat -f%z "$dest")" -ge "$min" ]; then
    echo "  already there: $(basename "$dest")"; return 0
  fi
  for url in "$@"; do
    echo "  from $url"
    if curl -fL --retry 3 -C - --progress-bar -o "$dest.part" "$url" \
       && [ "$(stat -f%z "$dest.part")" -ge "$min" ]; then
      mv "$dest.part" "$dest"; echo "  ✓ $(basename "$dest")"; return 0
    fi
    rm -f "$dest.part"
  done
  printf '  \033[31m✗ could not download %s\033[0m\n' "$(basename "$dest")"; return 1
}

step "Whisper model (speech-to-text)"
download "$ROOT/models/whisper/ggml-large-v3-turbo-q5_0.bin" 500000000 \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"

step "Qwen3-4B-Instruct-2507 (language model)"
download "$ROOT/models/llm/Qwen3-4B-Instruct-2507-Q4_K_M.gguf" 2000000000 \
  "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf" \
  "https://huggingface.co/lmstudio-community/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf" \
  "https://huggingface.co/bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf"

step "Done — double-click start-ailean.command"
read -r -p "Press Enter to close…"
