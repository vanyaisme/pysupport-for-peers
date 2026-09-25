#!/usr/bin/env python3
"""
Local dev server with COOP/COEP headers required for SharedArrayBuffer.

Usage:
    python3 serve.py          # serves on http://localhost:8080
    python3 serve.py 3000     # custom port
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlsplit
from http.server import HTTPServer, SimpleHTTPRequestHandler


class COIHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        pathname = urlsplit(self.path).path
        matches = False
        for line in Path("_headers").read_text().splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            if not line.startswith(" "):
                pattern = line.strip()
                matches = (pathname.startswith(pattern[:-1]) if pattern.endswith("*")
                           else pathname == pattern)
            elif matches:
                name, value = line.strip().split(":", 1)
                self.send_header(name, value.strip())
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f"  {args[0]}  {args[1]}")


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))
server = HTTPServer(("127.0.0.1", port), COIHandler)
print(f"Serving at http://127.0.0.1:{server.server_port}  (COOP + COEP enabled)")
server.serve_forever()
