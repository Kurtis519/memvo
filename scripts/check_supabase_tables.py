import json
import os
import requests

base_url = os.environ['EXPO_PUBLIC_SUPABASE_URL'].rstrip('/')
service_role_key = os.environ['SUPABASE_SERVICE_ROLE_KEY']

headers = {
    'apikey': service_role_key,
    'Authorization': f'Bearer {service_role_key}',
}

for table in ['user_profiles', 'notes', 'folders', 'sync_queue', 'referrals', 'admin_actions']:
    url = f"{base_url}/rest/v1/{table}?select=*&limit=1"
    response = requests.get(url, headers=headers, timeout=30)
    print(json.dumps({
        'table': table,
        'status_code': response.status_code,
        'body': response.text[:300],
    }))
