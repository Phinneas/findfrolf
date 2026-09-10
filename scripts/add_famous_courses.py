#!/usr/bin/env python3
"""Add famous national disc golf courses (outside our 15 metros) to the directory."""
import json
import re
from datetime import date

from scrapling.fetchers import DynamicSession

OUT_DIR = "/Users/chesterbeard/CascadeProjects/findfrolf/src/content/courses/"
TODAY = date.today().isoformat()

# (udisc slug, state abbrev, city)
COURSES = [
    ("the-preserve-black-bear-XsGU", "MN", "Clearwater"),
    ("fox-run-meadows-yi3h", "VT", "Cambridge"),
]

STATE_FULL = {"MA": "Massachusetts", "CA": "California", "MI": "Michigan", "PA": "Pennsylvania",
              "MD": "Maryland", "VT": "Vermont", "TX": "Texas", "MN": "Minnesota"}

DIFF_LABEL = {1: "Easy", 2: "Easy", 3: "Moderate", 4: "Hard", 5: "Very Hard"}
LENGTH_LABEL = {"short": "Short", "medium": "Medium", "long": "Long"}


def page_action(page):
    page.evaluate("""() => { const el = document.querySelector('section#layouts'); if (el) el.scrollIntoView({block:'center'}); }""")
    for _ in range(25):
        page.wait_for_timeout(800)
        n = page.evaluate("document.querySelectorAll('div.grid.grid-cols-10').length")
        if n >= 2:
            break


def fetch_jsonld(resp):
    blocks = []
    for raw in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', resp.html_content, re.S):
        try:
            blocks.append(json.loads(raw))
        except Exception:
            continue
    return blocks


def parse_layout(resp):
    holes = []
    for g in resp.css("div.grid.grid-cols-10"):
        kids = g.css(":scope > div")
        for cell in kids[1:]:
            divs = cell.css(":scope > div")
            if len(divs) < 3:
                continue
            h = int("".join(c for c in divs[0].get_all_text() if c.isdigit()) or 0)
            dist = int("".join(c for c in divs[1].get_all_text() if c.isdigit()) or 0)
            par = int("".join(c for c in divs[2].get_all_text() if c.isdigit()) or 0)
            if h and dist and par:
                holes.append((h, dist, par))
    seen, dedup = set(), []
    for h in sorted(holes):
        if h[0] not in seen:
            seen.add(h[0])
            dedup.append(h)
    if not dedup:
        return None
    return len(dedup), sum(h[2] for h in dedup), sum(h[1] for h in dedup)


def clean(s):
    return (s or "").strip().strip('"').strip("'").strip()


def main():
    import os
    codes = {}
    for fn in os.listdir(OUT_DIR):
        if fn.endswith(".json"):
            try:
                d = json.load(open(os.path.join(OUT_DIR, fn)))
                m = re.match(r"^([A-Z]{2})-(\d+)$", d.get("code", ""))
                if m:
                    codes[m.group(1)] = max(codes.get(m.group(1), 0), int(m.group(2)))
            except Exception:
                pass

    with DynamicSession(headless=True, timeout=60000) as session:
        for slug, st, city in COURSES:
            url = f"https://udisc.com/courses/{slug}"
            out_path = os.path.join(OUT_DIR, slug + ".json")
            if os.path.exists(out_path):
                print(f"SKIP {slug}: already exists", flush=True)
                continue
            try:
                resp = session.fetch(url, page_action=page_action, timeout=60000, wait=800, google_search=False)
            except Exception as e:
                print(f"SKIP {slug}: fetch err {e}", flush=True)
                continue

            blocks = fetch_jsonld(resp)
            locs = [b for b in blocks if b.get("@type") == "SportsActivityLocation"]
            loc = next((b for b in locs if (b.get("@id") or "").rstrip("/") == url.rstrip("/")), None)
            if loc is None:
                loc = locs[0] if locs else None
            faq = next((b for b in blocks if b.get("@type") == "FAQPage"), None)

            name = clean((loc or {}).get("name")) or slug.replace("-", " ").title()
            addr = (loc or {}).get("address", {}) or {}
            city_ld = (addr.get("addressLocality", "") or city).split(",")[0].strip()
            state_full = addr.get("addressRegion") or STATE_FULL[st]
            state_slug = st.lower()

            lat = lng = None
            if faq:
                for q in faq.get("mainEntity", []):
                    ans = (q.get("acceptedAnswer", {}) or {}).get("text", "")
                    m = re.search(r"located at\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", ans)
                    if m:
                        lat, lng = float(m.group(1)), float(m.group(2))
                        break

            rating = (loc or {}).get("aggregateRating", {}) or {}
            rv = rating.get("ratingValue")
            rc = rating.get("ratingCount") or rating.get("reviewCount")
            rating_val = round(float(rv), 1) if rv is not None else 0.0
            review_count = int(rc) if rc else 0

            layout = parse_layout(resp)
            if not layout:
                print(f"SKIP {slug}: no layout", flush=True)
                continue
            holes, par, total_feet = layout

            course_length = "short" if total_feet < 5000 else ("long" if total_feet > 7000 else "medium")
            dscore = 1 + (1 if holes >= 18 else 0) + (1 if total_feet >= 7000 else 0)
            dscore = max(1, min(5, dscore))
            difficulty = DIFF_LABEL[dscore]

            codes[st] = codes.get(st, 9000) + 1
            code = f"{st}-{codes[st]}"

            entry = {
                "name": name, "code": code, "city": city_ld, "state": state_full,
                "citySlug": re.sub(r"[^a-z0-9]+", "-", city_ld.lower()).strip("-"), "stateSlug": state_slug,
                "area": city_ld,
                "location": {"address": f"{city_ld}, {state_full}", "lat": lat or 0, "lng": lng or 0},
                "holes": holes, "par": par, "parSource": "udisc", "totalFeet": total_feet,
                "courseLength": course_length, "difficulty": difficulty, "difficultyRating": dscore,
                "isFree": True, "greenFee": "$0",
                "pdgaCourseId": None, "pdgaTier": None, "websiteUrl": None,
                "photos": [{"url": "/images/course-placeholder.svg", "alt": f"{name} — photo coming soon",
                            "caption": "Placeholder — upgrade when a real photo becomes available"}],
                "heroImage": "/images/course-placeholder.svg", "thumbnail": "/images/course-placeholder.svg",
                "rating": rating_val, "reviewCount": review_count,
                "tags": ["Free", LENGTH_LABEL[course_length], f"{holes} Holes"],
                "amenities": {"restrooms": False, "parking": True, "water": False, "lighting": False,
                              "proShop": False, "dogFriendly": False, "cartFriendly": False,
                              "handicapAccessible": False, "camping": False},
                "facts": {"parking": "Unknown", "restrooms": "No", "proShop": "No on-site",
                          "dogs": "Unknown", "baskets": "Unknown", "lighting": "None", "hours": "Unknown"},
                "yearEstablished": None, "lastVerified": TODAY, "courseDesigner": None,
                "teeType": None, "basketType": None, "elevation": None, "foliage": None,
                "aboutParagraphs": [f"{name} is an {holes}-hole course in {city_ld}, {state_full}, "
                                    f"playing {total_feet:,} feet at par {par}. Sourced from UDisc on {TODAY}."],
                "holeData": [], "layoutMapUrl": None, "signatureHoleDescription": None, "localTips": None,
                "reviews": [], "tournaments": [], "nearbyCourseSlugs": [],
                "isBeginnerFriendly": False, "isWooded": False, "isOpen": False,
            }
            with open(out_path, "w") as f:
                json.dump(entry, f, indent=2)
                f.write("\n")
            print(f"CREATED {code} {name} ({city_ld}, {state_full}) {rating_val}★ ({review_count})", flush=True)


if __name__ == "__main__":
    main()
