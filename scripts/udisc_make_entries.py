#!/usr/bin/env python3
"""Generate base course entries for UDisc-only courses.

For each UDisc-only card (udisc_only.json), fetch the UDisc course page and
build a base entry from VERIFIED UDisc data only (JSON-LD + rendered layout
grid). No hole-by-hole data, no invented par/feet — courses whose par/feet can't
be sourced are skipped to a report.

Output: writes src/content/courses/{slug}.json + udisc_skipped.json.
"""
import json
import re
import sys
from datetime import date

from scrapling.fetchers import DynamicSession

ONLY = sys.argv[1] if len(sys.argv) > 1 else "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_only_confirmed.json"
OUT_DIR = "/Users/chesterbeard/CascadeProjects/findfrolf/src/content/courses/"
SKIP = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_skipped.json"

TODAY = date.today().isoformat()

HUB_SLUG = {
    "Austin": "austin", "Denver": "denver", "Portland": "portland",
    "Chicago": "chicago", "Seattle": "seattle", "Charlotte": "charlotte",
    "Houston": "houston", "Phoenix": "phoenix", "Nashville": "nashville",
    "Raleigh-Durham": "raleigh", "Dallas-Fort Worth": "dallas-fort-worth",
    "Kansas City": "kansas-city", "Atlanta": "atlanta", "Cincinnati": "cincinnati",
    "Minneapolis-St. Paul": "minneapolis-st-paul",
}

STATE_SLUG = {
    "alabama": "al", "arizona": "az", "colorado": "co", "georgia": "ga",
    "illinois": "il", "indiana": "in", "kansas": "ks", "kentucky": "ky",
    "minnesota": "mn", "missouri": "mo", "north carolina": "nc", "ohio": "oh",
    "oregon": "or", "tennessee": "tn", "texas": "tx", "washington": "wa",
    "wisconsin": "wi", "south carolina": "sc",
}

DIFF_LABEL = {1: "Easy", 2: "Easy", 3: "Moderate", 4: "Hard", 5: "Very Hard"}
LENGTH_LABEL = {"short": "Short", "medium": "Medium", "long": "Long"}


def page_action(page):
    page.evaluate("""() => {
        const el = document.querySelector('section#layouts');
        if (el) el.scrollIntoView({block:'center'});
    }""")
    for _ in range(25):
        page.wait_for_timeout(800)
        n = page.evaluate("document.querySelectorAll('div.grid.grid-cols-10').length")
        if n >= 2:
            break


def fetch_jsonld_blocks(resp):
    html = resp.html_content
    blocks = []
    for raw in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        try:
            blocks.append(json.loads(raw))
        except Exception:
            continue
    return blocks


def parse_layout(resp):
    """Return (holes, par, totalFeet) from the rendered hole grid, or None."""
    grids = resp.css("div.grid.grid-cols-10")
    holes = []
    for g in grids:
        kids = g.css(":scope > div")
        for cell in kids[1:]:
            divs = cell.css(":scope > div")
            if len(divs) < 3:
                continue
            h = int("".join(ch for ch in divs[0].get_all_text() if ch.isdigit()) or 0)
            dist = int("".join(ch for ch in divs[1].get_all_text() if ch.isdigit()) or 0)
            par = int("".join(ch for ch in divs[2].get_all_text() if ch.isdigit()) or 0)
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


def clean_name(s):
    s = (s or "").strip()
    s = s.strip('"').strip("'").strip()
    return s


def rubric_score(holes, total_feet):
    s = 1
    if holes >= 18:
        s += 1
    if total_feet >= 7000:
        s += 1
    return max(1, min(5, s))


def main():
    only = json.load(open(ONLY))
    skipped = []
    created = []
    codes = {}  # state_abbr -> next number

    # prime counters to avoid collisions with existing codes
    import os
    for fn in os.listdir(OUT_DIR):
        if fn.endswith(".json"):
            try:
                d = json.load(open(os.path.join(OUT_DIR, fn)))
                c = d.get("code", "")
                m = re.match(r"^([A-Z]{2})-(\d+)$", c)
                if m:
                    st, num = m.group(1), int(m.group(2))
                    codes[st] = max(codes.get(st, 0), num)
            except Exception:
                pass

    with DynamicSession(headless=True, timeout=60000) as session:
        for metro, cards in only.items():
            hub = HUB_SLUG.get(metro, metro.lower().replace(" ", "-"))
            for card in cards:
                slug = card["slug"].split("/")[-1]
                url = "https://udisc.com/courses/" + slug
                out_path = os.path.join(OUT_DIR, slug + ".json")
                if os.path.exists(out_path):
                    print(f"SKIP (exists) {slug}", flush=True)
                    continue
                try:
                    resp = session.fetch(url, page_action=page_action, timeout=60000, wait=800, google_search=False)
                except Exception as e:
                    skipped.append({"slug": slug, "reason": f"fetch error {type(e).__name__}: {str(e)[:100]}"})
                    print(f"SKIP {slug}: fetch error {e}", flush=True)
                    continue

                blocks = fetch_jsonld_blocks(resp)
                url = resp.url
                locs = [b for b in blocks if b.get("@type") == "SportsActivityLocation"]
                loc = next((b for b in locs if (b.get("@id") or "").rstrip("/") == url.rstrip("/")), None)
                if loc is None:
                    loc = locs[0] if locs else None
                faq = next((b for b in blocks if b.get("@type") == "FAQPage"), None)

                name = clean_name((loc or {}).get("name"))
                if not name:
                    h3 = resp.css("h1")
                    name = clean_name(h3[0].get_all_text()) if h3 else slug

                addr = (loc or {}).get("address", {}) or {}
                city = addr.get("addressLocality", "").split(",")[0].strip()
                state_full = addr.get("addressRegion", "") or card.get("state", "")
                state_slug = STATE_SLUG.get(state_full.lower(), (state_full[:2].lower() if state_full else ""))

                # coords from FAQ answer ("located at LAT, LNG")
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
                    skipped.append({"slug": slug, "name": name, "reason": "no par/feet in layout grid"})
                    print(f"SKIP {slug}: no layout data", flush=True)
                    continue
                holes, par, total_feet = layout

                if lat is None or lng is None:
                    skipped.append({"slug": slug, "name": name, "reason": "no coords in FAQ"})
                    print(f"SKIP {slug}: no coords", flush=True)
                    continue

                # free/paid + amenities from FAQ
                is_free = False
                if faq:
                    for q in faq.get("mainEntity", []):
                        ans = (q.get("acceptedAnswer", {}) or {}).get("text", "").lower()
                        if "free to play" in ans:
                            is_free = True
                        if "free to play" in ans or "pay to play" in ans:
                            break
                amenities = {"restrooms": False, "parking": True, "water": False, "lighting": False,
                             "proShop": False, "dogFriendly": False, "cartFriendly": False,
                             "handicapAccessible": False, "camping": False}
                if faq:
                    for q in faq.get("mainEntity", []):
                        ans = (q.get("acceptedAnswer", {}) or {}).get("text", "").lower()
                        if "restroom" in ans:
                            amenities["restrooms"] = True
                        if "drinking water" in ans or " water" in ans:
                            amenities["water"] = True
                        if "cart-friendly" in ans or "cart friendly" in ans:
                            amenities["cartFriendly"] = True
                        if "pet-friendly" in ans or "dog" in ans:
                            amenities["dogFriendly"] = True

                course_length = "short" if total_feet < 5000 else ("long" if total_feet > 7000 else "medium")
                dscore = rubric_score(holes, total_feet)
                difficulty = DIFF_LABEL[dscore]

                # code
                st_abbr = state_slug.upper()
                nxt = codes.get(st_abbr, 9000) + 1
                codes[st_abbr] = nxt
                code = f"{st_abbr}-{nxt}"

                entry = {
                    "name": name,
                    "code": code,
                    "city": city or card.get("city", ""),
                    "state": state_full,
                    "citySlug": hub,
                    "stateSlug": state_slug,
                    "area": city or card.get("city", ""),
                    "location": {
                        "address": f"{city or card.get('city','')}, {state_full}".strip(", "),
                        "lat": lat if lat is not None else 0,
                        "lng": lng if lng is not None else 0,
                    },
                    "holes": holes,
                    "par": par,
                    "parSource": "udisc",
                    "totalFeet": total_feet,
                    "courseLength": course_length,
                    "difficulty": difficulty,
                    "difficultyRating": dscore,
                    "isFree": is_free,
                    "greenFee": "$0" if is_free else "Unknown",
                    "pdgaCourseId": None,
                    "pdgaTier": None,
                    "websiteUrl": None,
                    "photos": [
                        {"url": "/images/course-placeholder.svg", "alt": f"{name} — photo coming soon",
                         "caption": "Placeholder — upgrade when a real photo becomes available"}
                    ],
                    "heroImage": "/images/course-placeholder.svg",
                    "thumbnail": "/images/course-placeholder.svg",
                    "rating": rating_val,
                    "reviewCount": review_count,
                    "tags": [("Free" if is_free else "Paid"), LENGTH_LABEL[course_length], f"{holes} Holes"],
                    "amenities": amenities,
                    "facts": {
                        "parking": "Unknown",
                        "restrooms": "Yes" if amenities["restrooms"] else "No",
                        "proShop": "No on-site",
                        "dogs": "Dogs ok" if amenities["dogFriendly"] else "Unknown",
                        "baskets": "Unknown",
                        "lighting": "None",
                        "hours": "Unknown",
                    },
                    "yearEstablished": None,
                    "lastVerified": TODAY,
                    "courseDesigner": None,
                    "teeType": None,
                    "basketType": None,
                    "elevation": None,
                    "foliage": None,
                    "aboutParagraphs": [
                        f"{name} is an {holes}-hole course in {city or card.get('city','')}, {state_full}, "
                        f"playing {total_feet:,} feet at par {par}."
                        + (f" UDisc lists it as free to play." if is_free else "") +
                        f" Course details sourced from UDisc on {TODAY}."
                    ],
                    "holeData": [],
                    "layoutMapUrl": None,
                    "signatureHoleDescription": None,
                    "localTips": None,
                    "reviews": [],
                    "tournaments": [],
                    "nearbyCourseSlugs": [],
                    "isBeginnerFriendly": False,
                    "isWooded": False,
                    "isOpen": False,
                }

                with open(out_path, "w") as f:
                    json.dump(entry, f, indent=2)
                    f.write("\n")
                created.append({"slug": slug, "name": name, "metro": metro, "code": code})
                print(f"CREATED {code} {name} ({city}, {state_full}) par={par} {total_feet}ft", flush=True)

    json.dump({"created": created, "skipped": skipped}, open(SKIP, "w"), indent=1)
    print(f"\ncreated {len(created)} entries, skipped {len(skipped)}")
    print("wrote", SKIP, flush=True)


if __name__ == "__main__":
    main()
