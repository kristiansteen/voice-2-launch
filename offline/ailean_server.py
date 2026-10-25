#!/usr/bin/env python3
"""AILEAN offline server.

Serves the offline build of the app and forwards its AI calls to the local
model servers. Binds to 127.0.0.1 only, so nothing on the network can reach it
and nothing it does leaves the machine.

    /llm/...  -> llamafile / llama.cpp  (default 127.0.0.1:8080)
    /stt/...  -> whisper.cpp server     (default 127.0.0.1:8081)
    /tts      -> Piper HTTP server      (default 127.0.0.1:5000)
    anything else -> static files from the app folder (SPA fallback to index.html)

Python standard library only. Usage:
    python3 ailean_server.py --app ./app --port 4173
"""
import argparse
import http.client
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

UPSTREAMS = {
    "/llm": ("127.0.0.1", int(os.environ.get("AILEAN_LLM_PORT", 8080)), ""),
    "/stt": ("127.0.0.1", int(os.environ.get("AILEAN_STT_PORT", 8081)), ""),
    "/tts": ("127.0.0.1", int(os.environ.get("AILEAN_TTS_PORT", 5000)), ""),
}
TIMEOUT = 900  # seconds; long transcripts on a laptop GPU can take minutes
HOP_HEADERS = {"connection", "keep-alive", "transfer-encoding", "te", "trailer",
               "upgrade", "proxy-authorization", "proxy-authenticate", "host"}


def match_upstream(path):
    for prefix, target in UPSTREAMS.items():
        if path == prefix or path.startswith(prefix + "/"):
            host, port, base = target
            rest = path[len(prefix):] or "/"
            return host, port, base + rest
    return None


class Handler(SimpleHTTPRequestHandler):
    server_version = "AILEAN-offline"

    def log_message(self, fmt, *args):  # quieter console
        sys.stderr.write("  %s\n" % (fmt % args))

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
    args = ap.parse_args()
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
