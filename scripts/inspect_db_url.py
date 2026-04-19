from urllib.parse import urlparse
import os

url = os.environ.get('DATABASE_URL', '')
if not url:
    print('DATABASE_URL missing')
    raise SystemExit(1)

parsed = urlparse(url)
print({'scheme': parsed.scheme, 'hostname': parsed.hostname, 'port': parsed.port, 'path': parsed.path})
