#!/usr/bin/env python3
"""Reverse-geocode UDisc markers to municipalities and filter into metro lists.

Reads udisc_markers.csv (courseId,holeCount,lat,lng), keeps markers within each
metro's radius, reverse-geocodes them via OSM Nominatim (cached, ~1 req/sec), and
filters by the metro's municipality list (scripts/metros.json) + state.

Output: udisc_metro_markers.json { metro: {count, markers:[{courseId,holes,lat,
lng,locality,state}] } } and udisc_geocode_cache.json.
"""
import csv
import io
import json
import math
import sys
import time
import urllib.parse
import urllib.request

CSV = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_markers.csv"
METROS = json.load(open("/Users/chesterbeard/CascadeProjects/findfrolf/scripts/metros.json"))
CACHE = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_geocode_cache.json"
OUT = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_metro_markers.json"

# center, radius_miles
CENTERS = {
    "Austin": (30.2672, -97.7431, 28),
    "Denver": (39.7392, -104.9903, 30),
    "Portland": (45.5152, -122.6784, 25),
    "Chicago": (41.8781, -87.6298, 35),
    "Seattle": (47.6062, -122.3321, 35),
    "Charlotte": (35.2271, -80.8431, 30),
    "Houston": (29.7604, -95.3698, 35),
    "Phoenix": (33.4484, -112.0740, 35),
    "Nashville": (36.1627, -86.7816, 30),
    "Raleigh-Durham": (35.7796, -78.6382, 30),
    "Dallas-Fort Worth": (32.7767, -96.7970, 40),
    "Kansas City": (39.0997, -94.5786, 30),
    "Atlanta": (33.7490, -84.3880, 35),
    "Cincinnati": (39.1031, -84.5120, 28),
    "Minneapolis-St. Paul": (44.9778, -93.2650, 35),
}

STATE_ABBR = {
    "alabama": "AL", "arizona": "AZ", "arkansas": "AR", "colorado": "CO",
    "connecticut": "CT", "georgia": "GA", "idaho": "ID", "illinois": "IL",
    "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY",
    "minnesota": "MN", "missouri": "MO", "north carolina": "NC",
    "ohio": "OH", "oregon": "OR", "tennessee": "TN", "texas": "TX",
    "utah": "UT", "washington": "WA", "wisconsin": "WI",
}


def haversine(lat1, lon1, lat2, lon2):
    R = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


def reverse_geocode(lat, lng):
    url = (
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2"
        f"&lat={lat}&lon={lng}&zoom=13&addressdetails=1"
    )
    req = urllib.request.Request(url, headers={
        "User-Agent": "FindFrolf course directory (disc golf); contact findfrolf@example.com",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def locality_of(addr):
    for k in ("city", "town", "village", "hamlet", "municipality", "suburb"):
        if addr.get(k):
            return addr[k]
    return addr.get("county") or ""


def state_of(addr):
    s = addr.get("state") or ""
    return STATE_ABBR.get(s.lower(), s.upper())


def load_cache():
    try:
        return json.load(open(CACHE))
    except Exception:
        return {}


def save_cache(c):
    json.dump(c, open(CACHE, "w"))


def main():
    rows = list(csv.DictReader(io.StringIO(open(CSV, encoding="utf-8").read())))
    print(f"loaded {len(rows)} UDisc markers", flush=True)
    cache = load_cache()

    # markers per metro (within radius), deduped globally by courseId
    metro_markers = {m: {} for m in METROS}
    for row in rows:
        lat, lng = float(row["latitude"]), float(row["longitude"])
        cid = row["courseId"]
        for metro, (clat, clng, r) in CENTERS.items():
            if haversine(clat, clng, lat, lng) <= r:
                metro_markers[metro][cid] = {"courseId": cid, "holeCount": row["holeCount"], "lat": lat, "lng": lng}

    # union of all unique markers to reverse-geocode
    all_markers = {}
    for m in metro_markers.values():
        all_markers.update(m)
    print(f"unique markers in all metro radii: {len(all_markers)}", flush=True)

    # reverse-geocode (cached)
    todo = [m for m in all_markers.values() if m["courseId"] not in cache]
    print(f"to reverse-geocode: {len(todo)}", flush=True)
    for i, mk in enumerate(todo):
        cid = mk["courseId"]
        try:
            data = reverse_geocode(mk["lat"], mk["lng"])
            cache[cid] = data.get("address", {})
        except Exception as e:
            print(f"  geocode err {cid}: {type(e).__name__} {str(e)[:80]}", flush=True)
            cache[cid] = {}
        if (i + 1) % 50 == 0:
            save_cache(cache)
            print(f"  ...geocoded {i+1}/{len(todo)}", flush=True)
        time.sleep(1.05)
    save_cache(cache)

    # filter per metro
    out = {}
    for metro, markers in metro_markers.items():
        locs = set(norm(l) for l in METROS[metro]["localities"])
        states = set(METROS[metro]["states"])
        keep = []
        for mk in markers.values():
            addr = cache.get(mk["courseId"], {})
            if not addr:
                continue
            loc = norm(locality_of(addr))
            st = state_of(addr)
            if loc in locs and st in states:
                keep.append({
                    "courseId": mk["courseId"],
                    "holeCount": int(mk["holeCount"] or 0),
                    "lat": mk["lat"],
                    "lng": mk["lng"],
                    "locality": locality_of(addr),
                    "state": st,
                })
        out[metro] = {"count": len(keep), "markers": keep}
        print(f"{metro}: {len(keep)} in-metro (of {len(markers)} in radius)", flush=True)

    json.dump(out, open(OUT, "w"), indent=1)
    print("wrote", OUT, flush=True)


if __name__ == "__main__":
    main()
