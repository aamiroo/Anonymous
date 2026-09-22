"""Minimal dev server for the frontend — separate from the FastAPI backend.

Usage:
    python serve.py [port]

Serves frontend/ on the given port (default 3000).
Set API_BASE in frontend/js/app.js to point at your FastAPI backend.
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def end_headers(self):
        # CORS headers for dev — allows frontend to call a separate backend
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

if __name__ == "__main__":
    with http.server.HTTPServer(("0.0.0.0", PORT), Handler) as s:
        print(f"Frontend: http://localhost:{PORT}")
        s.serve_forever()
