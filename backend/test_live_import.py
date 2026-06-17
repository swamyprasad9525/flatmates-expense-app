import os
import django
import urllib.request
import urllib.error
import json

# Setup Django environment to parse the CSV locally
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from expenses.utils import parse_csv_export

def run_live_import_test():
    # 1. Read the CSV export file
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'expenses_export.csv')
    with open(csv_path, 'r', encoding='utf-8') as f:
        file_content = f.read()

    # 2. Parse the CSV file using our parser logic
    print("Parsing CSV export locally...")
    rows = parse_csv_export(file_content, 1) # Assumes group ID 1

    # 3. Resolve the anomalies locally just like the frontend wizard does
    for r in rows:
        # Resolve Row 13 (Missing Payer) -> Set to Priya
        if r['csv_row_number'] == 13:
            r['paid_by'] = 'Priya'
            r['anomalies'] = [] # Clean resolved anomalies
        
        # Exclude Row 31 (Zero Amount)
        if r['csv_row_number'] == 31:
            r['exclude'] = True

        # Exclude Row 6 (Duplicate of Marina Bites)
        if r['csv_row_number'] == 6:
            r['exclude'] = True

        # Exclude Row 24 (Duplicate of Thalassa)
        if r['csv_row_number'] == 24:
            r['exclude'] = True

    # 4. Make a POST request to the live Render API backend to commit the resolved data
    token = '4859b44e9e42fb7ffd99cfb9310fdc95bf24c9ba' # Verified token for Rohan
    url = 'https://flatmates-expense-app.onrender.com/api/groups/1/import/confirm/'
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    
    print(f"Submitting {len(rows)} resolved rows to live backend {url}...")
    req = urllib.request.Request(url, data=json.dumps({'rows': rows}).encode('utf-8'), headers=headers)
    
    try:
        r = urllib.request.urlopen(req)
        print("Success!")
        print(r.status, r.read().decode()[:400])
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}:")
        print(e.read().decode()[:800])

if __name__ == '__main__':
    run_live_import_test()
