import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_discogs():
    token = os.getenv("VITE_DISCOGS_TOKEN")
    url = "https://api.discogs.com/database/search?q=Argentina&type=release&per_page=1"
    headers = {"Authorization": f"Discogs token={token}"}
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            print("OK [Discogs API]: Connected")
            return True
        else:
            print(f"ERROR [Discogs API]: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"EXCEPTION [Discogs API]: {e}")
        return False

def test_geolocation():
    url = "https://ipapi.co/json/"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            print(f"OK [Geolocation API]: Connected (Location: {data.get('city')}, {data.get('country_name')})")
            return True
        else:
            print(f"ERROR [Geolocation API]: {response.status_code}")
            return False
    except Exception as e:
        print(f"EXCEPTION [Geolocation API]: {e}")
        return False

if __name__ == "__main__":
    d = test_discogs()
    g = test_geolocation()
    if d and g:
        print("\nSUCCESS: All links verified. Ready for Architecture phase.")
