import os
import requests
from dotenv import load_dotenv

load_dotenv()

def test_geolocation_alternative():
    # ip-api.com is free for non-commercial use, no key required
    url = "http://ip-api.com/json/"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                print(f"OK [ip-api.com]: Connected (Location: {data.get('city')}, {data.get('country')})")
                return True
            else:
                print(f"ERROR [ip-api.com]: {data.get('message')}")
                return False
        else:
            print(f"ERROR [ip-api.com]: {response.status_code}")
            return False
    except Exception as e:
        print(f"EXCEPTION [ip-api.com]: {e}")
        return False

if __name__ == "__main__":
    test_geolocation_alternative()
