"""
Local dev server for the toolkit.

Plain `python -m http.server` sends Last-Modified and lets the browser cache ES
modules aggressively. That is actively harmful here: after editing a module the
page can keep running the OLD one, so a change appears to have no effect, or -
worse - a verification appears to pass against code that is no longer on disk.
That happened repeatedly while splitting the wheel.

This sends no-store on everything, so every reload gets the current file.

Usage: python tools/serve.py [port]   (default 8000)
"""
import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_response(self, code, message=None):
        # Never let the browser reuse a cached copy via a conditional request.
        if code == 304:
            code = 200
        super().send_response(code, message)

    def log_message(self, fmt, *args):
        # keep the console readable: errors only
        if args and str(args[0]).startswith(('GET', 'HEAD')) and str(args[1]).startswith('2'):
            return
        super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    print('Serving %s at http://localhost:%d/  (no-store: edits always take effect)'
          % (ROOT, PORT))
    print('  hub     http://localhost:%d/' % PORT)
    print('  wheel   http://localhost:%d/wheel/' % PORT)
    print('  builder http://localhost:%d/builder/' % PORT)
    with Server(('', PORT), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nstopped')
