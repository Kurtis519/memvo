from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

SQL_PATH = Path('/home/ubuntu/memvo/supabase/bootstrap_memvo_schema.sql')
PORT = 8765

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        if self.path not in ('/', '/bootstrap_memvo_schema.sql'):
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'Not found')
            return

        content = SQL_PATH.read_text(encoding='utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(content.encode('utf-8'))

httpd = HTTPServer(('0.0.0.0', PORT), Handler)
print(f'Serving {SQL_PATH} on port {PORT}', flush=True)
httpd.serve_forever()
