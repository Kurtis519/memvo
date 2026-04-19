from urllib.parse import urlparse
import os

url = os.environ.get('EXPO_PUBLIC_SUPABASE_URL', '')
if not url:
    print('EXPO_PUBLIC_SUPABASE_URL missing')
    raise SystemExit(1)
parsed = urlparse(url)
host = parsed.hostname or ''
project_ref = host.split('.')[0] if host else ''
print({'host': host, 'project_ref': project_ref})
