#!/usr/bin/env python3
"""
Local dev server with COOP/COEP headers required for SharedArrayBuffer.

Usage:
    python3 serve.py          # serves on http://localhost:8080
    python3 serve.py 3000     # custom port
"""

import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class COIHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f"  {args[0]}  {args[1]}")


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"Serving at http://127.0.0.1:{port}  (COOP + COEP enabled)")
HTTPServer(("127.0.0.1", port), COIHandler).serve_forever()
