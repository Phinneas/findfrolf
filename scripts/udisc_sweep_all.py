#!/usr/bin/env python3
"""Enumerate named UDisc courses per metro via directory grid sweep.

Independent of reverse-geocoding: builds query points from CSV markers binned into
~0.15deg grid cells per metro, queries the directory at each cell centroid, and
dedupes server-rendered cards (name, slug, "City, State"). Cards are then filtered
by the metro's municipality list (scripts/metros.json).

Output: udisc_metro_cards.json { metro: {count, cards:[{name,slug,city,state}]} }
"""
import csv
import io
import json
import math
import re

from scrapling.fetchers import DynamicSession

CSV = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_markers.csv"
METROS = json.load(open("/Users/chesterbeard/CascadeProjects/findfrolf/scripts/metros.json"))
OUT = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_metro_cards.json"

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


def haversine(lat1, lon1, lat2, lon2):
    R = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin(math.radians(lat2 - lat1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


def parse_cards(sel):
    """Extract unique course cards from a directory response."""
    cards = {}
    for a in sel.css("a[href^='/courses/']"):
        href = a.attrib.get("href", "")
        if any(x in href for x in ("/add", "/edit", "/map", "/photos", "/reviews", "/leaderboard", "/v2/", "/caddie", "#", "?")):
            continue
        if href in cards:
            continue
        name = ""
        h3 = a.css("h3")
        if h3:
            name = h3[0].get_all_text().strip()
        city = ""
        state = ""
        for p in a.css("p"):
            t = p.get_all_text().strip()
            if "," in t:
                parts = [x.strip() for x in t.split(",", 1)]
                if len(parts) == 2 and parts[0] and parts[1]:
                    city, state = parts[0], parts[1]
                    break
        cards[href] = {"name": name, "slug": href, "city": city, "state": state}
    return cards


def build_points(markers):
    """Bin markers into ~0.15deg grid cells; return query points (lat,lng)."""
    cells = {}
    for mk in markers:
        glat = round(mk["lat"] / 0.15)
        glng = round(mk["lng"] / 0.15)
        cells.setdefault((glat, glng), []).append(mk)
    points = []
    for (glat, glng), ms in cells.items():
        lat = sum(m["lat"] for m in ms) / len(ms)
        lng = sum(m["lng"] for m in ms) / len(ms)
        points.append((lat, lng))
    return points


def main():
    rows = list(csv.DictReader(io.StringIO(open(CSV, encoding="utf-8").read())))
    out = {}
    with DynamicSession(headless=True, timeout=60000) as session:
        for metro, (clat, clng, r) in CENTERS.items():
            markers = []
            for row in rows:
                lat, lng = float(row["latitude"]), float(row["longitude"])
                if haversine(clat, clng, lat, lng) <= r:
                    markers.append({"lat": lat, "lng": lng})
            points = build_points(markers)
            print(f"\n=== {metro}: {len(markers)} markers, {len(points)} query cells", flush=True)
            cards = {}
            for i, (lat, lng) in enumerate(points):
                url = f"https://udisc.com/courses?latitude={lat}&longitude={lng}"
                try:
                    resp = session.fetch(url, timeout=60000, wait=400, google_search=False)
                    cards.update(parse_cards(resp))
                except Exception as e:
                    print(f"  [{metro} {i}] ERR {type(e).__name__}: {str(e)[:80]}", flush=True)
                if (i + 1) % 10 == 0:
                    print(f"  [{metro}] {i+1}/{len(points)} cells, {len(cards)} unique cards", flush=True)
            # filter by locality
            locs = set(norm(l) for l in METROS[metro]["localities"])
            kept = [c for c in cards.values() if norm(c["city"]) in locs]
            kept.sort(key=lambda c: c["name"])
            out[metro] = {"count": len(kept), "cards": kept, "raw_unique": len(cards)}
            print(f"  [{metro}] raw={len(cards)} after locality filter={len(kept)}", flush=True)

    json.dump(out, open(OUT, "w"), indent=1)
    print("\nwrote", OUT, flush=True)


if __name__ == "__main__":
    main()
