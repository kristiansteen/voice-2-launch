#!/usr/bin/env python3
"""AILEAN offline server.

Serves the offline build of the app and forwards its AI calls to the local
model servers. Binds to 127.0.0.1 only, so nothing on the network can reach it
and nothing it does leaves the machine.

    /llm/...  -> llamafile / llama.cpp  (default 127.0.0.1:8080)
    /stt/...  -> whisperfile CLI (--whisper-bin/--whisper-model), or a
                 whisper.cpp server on 127.0.0.1:8081 if no CLI is given
    /tts      -> Piper HTTP server on 127.0.0.1:5000 if running,
                 otherwise the built-in macOS voices (`say`)
    anything else -> static files from the app folder (SPA fallback to index.html)

Python standard library only. Usage:
    python3 ailean_server.py --app ./app --port 4173
"""
import argparse
import email
import email.policy
import http.client
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

UPSTREAMS = {
    "/llm": ("127.0.0.1", int(os.environ.get("AILEAN_LLM_PORT", 8080)), ""),
    "/stt": ("127.0.0.1", int(os.environ.get("AILEAN_STT_PORT", 8081)), ""),
    "/tts": ("127.0.0.1", int(os.environ.get("AILEAN_TTS_PORT", 5000)), ""),
}
TIMEOUT = 900  # seconds; long transcripts on a laptop GPU can take minutes
CONFIG = {"whisper_bin": None, "whisper_model": None}
_VOICES = None

HOP_HEADERS = {"connection", "keep-alive", "transfer-encoding", "te", "trailer",
               "upgrade", "proxy-authorization", "proxy-authenticate", "host"}


def match_upstream(path):
    for prefix, target in UPSTREAMS.items():
        if path == prefix or path.startswith(prefix + "/"):
            host, port, base = target
            rest = path[len(prefix):] or "/"
            return host, port, base + rest
    return None


def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.3):
            return True
    except OSError:
        return False


def parse_multipart(body, content_type):
    """Return {field: bytes} from a multipart/form-data body (stdlib only)."""
    msg = email.message_from_bytes(
        b"Content-Type: " + content_type.encode() + b"\r\n\r\n" + body,
        policy=email.policy.HTTP,
    )
    fields = {}
    for part in msg.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if name:
            fields[name] = part.get_payload(decode=True) or b""
    return fields


WHISPER_NOISE = re.compile(r"\[[^\]]*\]|^\s*\[\d.:\s>-]+\]\s*", re.M)

# Whisper was trained on subtitled TV: on silence or noise it "hears" subtitle
# credits and sign-offs. Remove those phrases wherever they appear.
WHISPER_HALLUCINATIONS = re.compile(
    r"(?i:(danske\s+)?(under)?tekst(er|ning)?\s+(af|ved))\s+[A-ZÆØÅ][\w-]+(\s+[A-ZÆØÅ][\w-]+)*(\s+(19|20)\d\d)?[.!?]?"
    r"|(?i:scandinavian\s+text\s+service)[^.!?\n]*[.!?]?"
    r"|(?i:\b(sdi\s+media|broadcast\s+text|nordisk\s+film\s+text)\b)[^.!?\n]*[.!?]?"
    r"|(?i:(subtitles?|captions?)\s+by\b)[^.!?\n]*[.!?]?"
    r"|(?i:amara\.org)[^.!?\n]*[.!?]?"
    r"|(?i:^\s*(tak\s+(for\s+(i\s+dag|at\s+se\s+med|nu))?|thank\s+you|thanks\s+for\s+watching)[.!]?\s*$)",
)


def clean_transcript(text):
    text = WHISPER_NOISE.sub(" ", text)
    text = WHISPER_HALLUCINATIONS.sub(" ", text)
    text = " ".join(text.split()).strip(" .,")
    return text if re.search(r"[^\W\d_]", text) else ""  # nothing but digits/punctuation left


def transcribe_cli(wav_bytes, lang):
    """Run whisperfile on one audio clip and return the text."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        path = f.name
    try:
        cmd = ["sh", CONFIG["whisper_bin"], "-m", CONFIG["whisper_model"], "-f", path,
               "-l", lang, "-nt", "-np", "-sns", "-t", str(min(8, os.cpu_count() or 4))]
        out = subprocess.run(cmd, capture_output=True, timeout=180)
        if out.returncode != 0:
            raise RuntimeError(out.stderr.decode(errors="replace")[-300:])
        return clean_transcript(out.stdout.decode(errors="replace"))
    finally:
        os.unlink(path)


def mac_voices():
    """Map language -> first installed macOS voice for it (cached)."""
    global _VOICES
    if _VOICES is None:
        _VOICES = {}
        try:
            listing = subprocess.run(["say", "-v", "?"], capture_output=True, timeout=10).stdout.decode()
            for line in listing.splitlines():
                m = re.match(r"^(.+?)\s+([a-z]{2})[_-][A-Z]{2}\s+#", line)
                if m:
                    _VOICES.setdefault(m.group(2), m.group(1).strip())
        except (OSError, subprocess.SubprocessError):
            pass
    return _VOICES


def speak_mac(text, lang):
    """Synthesise speech with the built-in macOS voices; returns WAV bytes."""
    if not shutil.which("say"):
        raise RuntimeError("No local voice available (macOS 'say' not found, Piper not running)")
    with tempfile.TemporaryDirectory() as d:
        txt, wav = os.path.join(d, "in.txt"), os.path.join(d, "out.wav")
        with open(txt, "w", encoding="utf-8") as f:
            f.write(text)
        cmd = ["say", "-f", txt, "-o", wav, "--file-format=WAVE", "--data-format=LEI16@22050"]
        voice = mac_voices().get(lang)
        if voice:
            cmd[1:1] = ["-v", voice]
        subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        with open(wav, "rb") as f:
            return f.read()


class Handler(SimpleHTTPRequestHandler):
    server_version = "AILEAN-offline"

    def log_message(self, fmt, *args):  # quieter console
        sys.stderr.write("  %s\n" % (fmt % args))

    def _send(self, status, data, ctype):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    # ── built-in handlers (no extra server needed) ───────────────────────────
    def _local(self):
        path = urlsplit(self.path).path
        if path.startswith("/stt") and CONFIG["whisper_bin"]:
            try:
                fields = parse_multipart(self._read_body(), self.headers.get("Content-Type", ""))
                lang = (fields.get("language") or b"da").decode()[:5] or "da"
                text = transcribe_cli(fields.get("file", b""), lang)
                self._send(200, json.dumps({"text": text}).encode(), "application/json")
            except Exception as e:  # noqa: BLE001
                self._send(500, f"Whisper failed: {e}".encode(), "text/plain; charset=utf-8")
            return True
        if path == "/tts" and not port_open(UPSTREAMS["/tts"][1]):
            try:
                req = json.loads(self._read_body() or b"{}")
                wav = speak_mac(req.get("text", ""), req.get("lang", "da"))
                self._send(200, wav, "audio/wav")
            except Exception as e:  # noqa: BLE001
                self._send(500, f"Voice failed: {e}".encode(), "text/plain; charset=utf-8")
            return True
        return False

    # ── proxy ────────────────────────────────────────────────────────────────
    def _proxy(self):
        url = urlsplit(self.path)
        target = match_upstream(url.path)
        if not target:
            return False
        host, port, path = target
        if url.query:
            path += "?" + url.query
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP_HEADERS}
        try:
            conn = http.client.HTTPConnection(host, port, timeout=TIMEOUT)
            conn.request(self.command, path, body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
        except OSError as e:
            name = {"/llm": "language model", "/stt": "Whisper", "/tts": "Piper"}
            svc = next((v for k, v in name.items() if url.path.startswith(k)), "service")
            msg = f"Local {svc} is not running on port {port} ({e})".encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            return True
        self.send_response(resp.status)
        for k, v in resp.getheaders():
            if k.lower() not in HOP_HEADERS and k.lower() != "content-length":
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        conn.close()
        return True

    def do_POST(self):
        if self._local():
            return
        if not self._proxy():
            self.send_error(404)

    def do_GET(self):
        if self._proxy():
            return
        # SPA fallback: unknown paths without a file extension serve index.html
        fs_path = self.translate_path(urlsplit(self.path).path)
        if not os.path.exists(fs_path) and "." not in os.path.basename(fs_path):
            self.path = "/index.html"
        super().do_GET()

    def end_headers(self):
        # Belt and braces: the browser may only talk to this server.
        if not self.path.startswith(("/llm", "/stt", "/tts")):
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; "
                "media-src 'self' blob:; style-src 'self' 'unsafe-inline'; "
                "script-src 'self' 'wasm-unsafe-eval'; font-src 'self' data:; "
                "worker-src 'self' blob:; frame-src 'none'",
            )
        super().end_headers()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "app"))
    ap.add_argument("--port", type=int, default=4173)
    ap.add_argument("--whisper-bin", help="whisperfile / whisper-cli binary (transcribes per request)")
    ap.add_argument("--whisper-model", help="Whisper ggml model for --whisper-bin")
    args = ap.parse_args()
    if args.whisper_bin and args.whisper_model:
        CONFIG["whisper_bin"], CONFIG["whisper_model"] = args.whisper_bin, args.whisper_model
    if not os.path.isfile(os.path.join(args.app, "index.html")):
        sys.exit(f"App build not found in {args.app} (run npm run build:offline)")
    handler = lambda *a, **kw: Handler(*a, directory=args.app, **kw)  # noqa: E731
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"AILEAN offline running at http://127.0.0.1:{args.port}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
