import math 
import os 
from decimal import Decimal, ROUND_HALF_UP
import requests
from django.core.cache import cache
from django.conf import settings

OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "http://localhost:5000")
Q2 = Decimal("0.01")

def _q2(dkm: float) -> Decimal:
    return Decimal(str(dkm)).quantize(Q2, rounding=ROUND_HALF_UP)

def osrm_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> Decimal | None:
    """
    Returns route distance in KM using OSRM (meters -> km), or None on error.
    """
    try:
        url = f"{OSRM_BASE_URL}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
        r = requests.get(url, params={"overview": "false", "alternatives": "false", "steps": "false"}, timeout=6)
        r.raise_for_status()
        data = r.json()
        routes = data.get("routes") or []
        if not routes:
            return None
        meters = routes[0].get("distance")
        if meters is None:
            return None
        return _q2(float(meters) / 1000.0)
    except Exception:
        return None

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> Decimal:
    """
    Straight-line (great-circle) distance in KM.
    """
    R = 6371.0
    p1 = math.radians(lat1); p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1); dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda/2) ** 2
    km = 2 * R * math.asin(math.sqrt(a))
    return _q2(km)

def _cache_key(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    # 6dp is enough—also means if a Localisation’s coords change, the key changes
    return f"osrm:km:{lat1:.6f},{lon1:.6f}->{lat2:.6f},{lon2:.6f}"

def distance_km_cached(lat1: float, lon1: float, lat2: float, lon2: float) -> Decimal:
    key = _cache_key(lat1, lon1, lat2, lon2)
    cached = cache.get(key)
    if cached is not None:
        # store Decimal directly; Django cache pickles it fine
        return Decimal(str(cached))
    km = osrm_distance_km(lat1, lon1, lat2, lon2)
    if km is None:
        km = haversine_km(lat1, lon1, lat2, lon2)
    cache.set(key, str(km), timeout=getattr(settings, "OSRM_CACHE_TTL_SECONDS", 604800))
    return km
