import os
import requests
from decimal import Decimal, ROUND_HALF_UP

NOMINATIM_BASE_URL = os.getenv("NOMINATIM_BASEURL", 'http://localhost:8080')
Q6 = Decimal('0.000001')

def _q6_str(x) -> str:
    d = Decimal(str(x)).quantize(Q6, rounding=ROUND_HALF_UP)
    return format(d, 'f')

def nominatim_search(q: str, limit: int = 10):
    if not q:
        return []
    params = {
            "q": q,
            "format": "jsonv2",
            "limit": limit,
            "addressdetails": 1,
            }

    headers = {
            "User-Agent": "LSTools/1.0"
            }

    r = requests.get(
            f"{NOMINATIM_BASE_URL}/search",
            params=params,
            headers=headers,
            timeout=8,
            )
    r.raise_for_status()
    data = r.json()
    results = []

    for item in data:
        lat = item.get("lat")
        lon = item.get("lon")
        if not lat or not lon:
            continue
        results.append({
            "display_name": item.get("display_name") or item.get("name") or q,
            "lat": _q6_str(lat),
            "lon": _q6_str(lon),
            "type": item.get("type"),
            "osm_id": item.get("osm_id"),
            })
    return results

