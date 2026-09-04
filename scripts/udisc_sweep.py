#!/usr/bin/env python3
"""Sweep UDisc's directory at multiple query points to enumerate a metro's courses.

Each query returns the ~20 nearest courses as server-rendered cards (name, slug,
"City, State", rating). Unioning cards across well-spread points approximates the
complete metro list. Output: JSON lines of unique courses by slug.
"""
import json
import sys
from scrapling.fetchers import DynamicSession

# Seattle test points (label -> lat, lng)
SEATTLE_POINTS = {
    "seattle": (47.6062, -122.3321),
    "tacoma": (47.2529, -122.4443),
    "everett": (47.9790, -122.2021),
    "bellevue": (47.6101, -122.2015),
    "kent": (47.3809, -122.2348),
    "bremerton": (47.5673, -122.6326),
    "olympia": (47.0379, -122.9007),
    "auburn": (47.3073, -122.2285),
    "redmond": (47.6740, -122.1215),
    "lynnwood": (47.8279, -122.3054),
    "marysville": (48.0518, -122.1771),
}


def make_page_action():
    def page_action(page):
        for _ in range(6):
            page.wait_for_timeout(900)
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    return page_action


def sweep(points, session):
    cards = {}
    for label, (lat, lng) in points.items():
        url = f"https://udisc.com/courses?latitude={lat}&longitude={lng}"
        try:
            resp = session.fetch(url, page_action=make_page_action(), timeout=60000, wait=800, google_search=False)
        except Exception as e:
            print(f"[{label}] ERROR {type(e).__name__}: {e}", flush=True)
            continue
        sel = resp
        got = 0
        for a in sel.css("a[href^='/courses/']"):
            href = a.attrib.get("href", "")
            if any(x in href for x in ("/add", "/edit", "/map", "/photos", "/reviews", "/leaderboard", "/v2/", "/caddie", "#", "?")):
                continue
            if href not in cards:
                # capture name (h3 within the card) and city/state
                name = ""
                city = ""
                card = a
                # climb to the card container (few levels up)
                for _ in range(4):
                    card = card.parent if card.parent else card
                h3 = card.css("h3")
                if h3:
                    name = h3[0].get_all_text().strip()
                p = card.css("p.text-sm")
                if p:
                    city = p[0].get_all_text().strip()
                cards[href] = {"slug": href, "name": name, "city": city}
                got += 1
        print(f"[{label}] new cards this point: {got} | total unique: {len(cards)}", flush=True)
    return cards


def main():
    points = SEATTLE_POINTS
    with DynamicSession(headless=True, timeout=60000) as session:
        cards = sweep(points, session)
    print("\n=== unique courses:", len(cards))
    for c in sorted(cards.values(), key=lambda x: x["name"]):
        print(f"  {c['name']} | {c['city']} | {c['slug']}")


if __name__ == "__main__":
    main()
