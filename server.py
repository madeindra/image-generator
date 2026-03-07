#!/usr/bin/env python3
import os
import sys
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else b''

        if self.path.startswith('/api/openai/'):
            openai_path = self.path[len('/api/openai'):]
            url = f'https://api.openai.com{openai_path}'
            headers = {k: v for k, v in self.headers.items()
                       if k.lower() not in ('host', 'authorization', 'content-length')}
            headers['Authorization'] = f'Bearer {OPENAI_API_KEY}'
            self._proxy(url, headers, body)

        elif self.path.startswith('/api/gemini/'):
            gemini_path = self.path[len('/api/gemini'):]
            url = f'https://generativelanguage.googleapis.com{gemini_path}'
            headers = {k: v for k, v in self.headers.items()
                       if k.lower() not in ('host', 'x-goog-api-key', 'content-length')}
            headers['x-goog-api-key'] = GEMINI_API_KEY
            self._proxy(url, headers, body)

        else:
            self.send_error(404)

    def _proxy(self, url, headers, body):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method='POST')
            with urllib.request.urlopen(req) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ('transfer-encoding', 'connection'):
                        self.send_header(k, v)
                self.send_header('Content-Length', len(resp_body))
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            for k, v in e.headers.items():
                if k.lower() not in ('transfer-encoding', 'connection'):
                    self.send_header(k, v)
            self.send_header('Content-Length', len(resp_body))
            self.end_headers()
            self.wfile.write(resp_body)

    def log_message(self, fmt, *args):
        print(f'  {self.address_string()} {fmt % args}')


if __name__ == '__main__':
    if not OPENAI_API_KEY and not GEMINI_API_KEY:
        print('Warning: neither OPENAI_API_KEY nor GEMINI_API_KEY is set.')

    port = int(os.environ.get('PORT', 8080))
    server = HTTPServer(('localhost', port), Handler)
    print(f'Serving at http://localhost:{port}')
    print(f'  OPENAI_API_KEY: {"(set)" if OPENAI_API_KEY else "(not set)"}')
    print(f'  GEMINI_API_KEY: {"(set)" if GEMINI_API_KEY else "(not set)"}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
