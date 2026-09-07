#!/usr/bin/env python3
"""Find and enter PDGA-only courses (on PDGA but not in the directory).

Pipeline:
1. Walk each state's PDGA directory -> name, city, holes, slug.
2. Fuzzy-name shortlist courses with no strong match in the directory.
3. Fetch each shortlisted course's PDGA page -> coords, length, holes, tee,
   elevation, foliage, rating, year.
4. Coordinate-dedup: if the coords are within 0.3mi of an existing entry,
   it's already entered (name alias) -> skip. Else create a base entry
   (parSource = pdga if par present, else estimated par = holes*3).
"""
import json
import math
import re
import urllib.request
import glob
from datetime import date

ROOT = "/Users/chesterbeard/CascadeProjects/findfrolf"
METROS = json.load(open(f"{ROOT}/scripts/metros.json"))
COURSES = f"{ROOT}/src/content/courses/"
TODAY = date.today().isoformat()

SLUG2METRO = {
    "austin": "Austin", "denver": "Denver", "portland": "Portland", "chicago": "Chicago",
    "seattle": "Seattle", "charlotte": "Charlotte", "houston": "Houston", "phoenix": "Phoenix",
    "nashville": "Nashville", "raleigh": "Raleigh-Durham", "dallas-fort-worth": "Dallas-Fort Worth",
    "kansas-city": "Kansas City", "atlanta": "Atlanta", "cincinnati": "Cincinnati",
    "minneapolis-st-paul": "Minneapolis-St. Paul", "san-marcos": "Austin", "round-rock": "Austin",
}
STATE_SLUG = {"alabama":"al","arizona":"az","colorado":"co","georgia":"ga","illinois":"il",
    "indiana":"in","kansas":"ks","kentucky":"ky","minnesota":"mn","missouri":"mo",
    "north carolina":"nc","ohio":"oh","oregon":"or","tennessee":"tn","texas":"tx",
    "washington":"wa","wisconsin":"wi","south carolina":"sc"}
STATE_ABBR = {"AZ":"Arizona","CO":"Colorado","GA":"Georgia","IL":"Illinois","IN":"Indiana",
    "KS":"Kansas","KY":"Kentucky","MN":"Minnesota","MO":"Missouri","NC":"North Carolina",
    "OH":"Ohio","OR":"Oregon","TN":"Tennessee","TX":"Texas","WA":"Washington","SC":"South Carolina"}
STOP = {"disc","golf","course","dgc","dg","park","the","at","memorial","community","discgolfpark","discgolf","club"}

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def norm(s):
    s = (s or "").lower()
    s = s.replace("&#039;", "'").replace("&amp;", "&")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def sig(s):
    return frozenset(t for t in norm(s).split() if t not in STOP and len(t) > 1)


def hav(lat1, lon1, lat2, lon2):
    R = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin(math.radians(lat2 - lat1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "replace")


def walk_state(state):
    courses = []
    for page in range(30):
        url = f"https://www.pdga.com/course-directory/advanced/search?field_course_location_administrative_area={state}&page={page}"
        html = fetch(url)
        rows = re.findall(r'<tr class="(?:odd|even)">([\s\S]*?)</tr>', html)
        if not rows:
            break
        for row in rows:
            m = re.search(r'course/([a-z0-9-]+)"[^>]*>([^<]+)<', row)
            city = (re.search(r'field-course-location" >\s*([^<]+)', row) or [None, ""])[1]
            holes = (re.search(r'field-course-holes" >\s*([^<]+)', row) or [None, ""])[1]
            if m:
                courses.append({"slug": m.group(1), "name": m.group(2).strip(), "city": city.strip(), "holes": holes.strip(), "state": state})
    return courses


def parse_pdga_page(slug):
    html = fetch(f"https://www.pdga.com/course-directory/course/{slug}")
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    coords = None
    m = re.search(r'(-?\d{2}\.\d{4,})\s*,\s*(-?\d{2,3}\.\d{4,})', html)
    if m:
        coords = (float(m.group(1)), float(m.group(2)))
    feet = None
    for pat in [r'Length:\s*([\d,]+)\s*ft', r'Course Length:\s*([\d,]+)']:
        m = re.search(pat, text)
        if m:
            feet = int(m.group(1).replace(",", ""))
            break
    holes = None
    m = re.search(r'Holes:\s*(\d+)', text)
    if m:
        holes = int(m.group(1))
    par = None
    m = re.search(r'\bPar:\s*(\d+)', text)
    if m:
        par = int(m.group(1))
    rating = 0.0
    m = re.search(r'Rating:\s*([\d.]+)', text)
    if m:
        rating = round(float(m.group(1)), 1)
    year = None
    m = re.search(r'Year Established:\s*(\d{4})', text)
    if m:
        year = int(m.group(1))
    tee = basket = elev = foliage = None
    m = re.search(r'Tee Type:\s*([A-Za-z ]+)', text)
    if m:
        tee = m.group(1).strip()
    m = re.search(r'Target Type:\s*([A-Za-z0-9 ]+)', text)
    if m:
        basket = m.group(1).strip()
    m = re.search(r'Elevation:\s*([A-Za-z0-9 /]+?)\s*(?:Foliage|Course Length|Hole Length)', text)
    if m:
        elev = m.group(1).strip()
    m = re.search(r'Foliage:\s*([A-Za-z ]+?)\s*(?:Course Length|Hole Length|Course Designer)', text)
    if m:
        foliage = m.group(1).strip()
    city = state_abbr = None
    m = re.search(r'Location:\s*([^,]+),\s*([A-Z]{2})', text)
    if m:
        city, state_abbr = m.group(1).strip(), m.group(2)
    return {"coords": coords, "feet": feet, "holes": holes, "par": par, "rating": rating,
            "year": year, "tee": tee, "basket": basket, "elevation": elev, "foliage": foliage,
            "city": city, "state_abbr": state_abbr}


def load_existing():
    entries = []
    codes = {}
    for f in glob.glob(COURSES + "*.json"):
        d = json.load(open(f))
        entries.append({"name": d["name"], "coords": (d["location"]["lat"], d["location"]["lng"]), "slug": f.split("/")[-1][:-5]})
        c = d.get("code", "")
        m = re.match(r"^([A-Z]{2})-(\d+)$", c)
        if m:
            codes[m.group(1)] = max(codes.get(m.group(1), 0), int(m.group(2)))
    return entries, codes


def main():
    # 1. walk all states
    states = set()
    for m in METROS.values():
        states.update(m["states"])
    pdga_courses = []
    for st in sorted(states):
        cs = walk_state(st)
        pdga_courses.extend(cs)
        print(f"{st}: {len(cs)} courses", flush=True)
    print(f"total PDGA walked: {len(pdga_courses)}", flush=True)

    # filter to metro localities (city AND state must match)
    metro_courses = {}
    locs_by_metro = {m: set(norm(l) for l in METROS[m]["localities"]) for m in METROS}
    states_by_metro = {m: set(s.lower() for s in METROS[m]["states"]) for m in METROS}
    for c in pdga_courses:
        cn = norm(c["city"])
        for metro in METROS:
            if cn in locs_by_metro[metro] and c["state"].lower() in states_by_metro[metro]:
                metro_courses.setdefault(metro, []).append(c)
                break
    total_metro = sum(len(v) for v in metro_courses.values())
    print(f"metro-filtered PDGA: {total_metro}", flush=True)

    existing, codes = load_existing()
    existing_norms = [norm(e["name"]) for e in existing]

    # 2. shortlist (fuzzy name < 0.6 against existing)
    shortlist = []
    for metro, cs in metro_courses.items():
        for c in cs:
            nn = norm(c["name"])
            best = 0.0
            for en in existing_norms:
                import difflib
                r = difflib.SequenceMatcher(None, nn, en).ratio()
                if r > best:
                    best = r
            if best < 0.60:
                shortlist.append((metro, c, best))
    print(f"shortlist (no name match >= 0.6): {len(shortlist)}", flush=True)

    # 3. fetch PDGA pages + coord-dedup
    missing = []
    for i, (metro, c, best) in enumerate(shortlist):
        try:
            info = parse_pdga_page(c["slug"])
        except Exception as e:
            print(f"  err {c['slug']}: {e}", flush=True)
            continue
        coords = info.get("coords")
        dup = False
        if coords:
            for e in existing:
                if hav(coords[0], coords[1], e["coords"][0], e["coords"][1]) < 0.3:
                    dup = True
                    break
        if dup:
            continue  # already entered under a different name
        missing.append((metro, c, info, best))
        print(f"  [{i+1}/{len(shortlist)}] MISSING {c['name']} ({c['city']}) coords={coords} feet={info.get('feet')} holes={info.get('holes')}", flush=True)

    print(f"\ntruly missing (coords not near any entry): {len(missing)}", flush=True)
    _out = [{"metro": m, "course": c, "info": i} for m, c, i, b in missing]
    json.dump(_out, open(f"{ROOT}/udisc_pdga_missing.json", "w"), indent=1)

    # 4. create entries
    created = 0
    for metro, c, info, best in missing:
        slug = c["slug"]
        if glob.glob(COURSES + slug + ".json"):
            continue
        coords = info.get("coords")
        if not coords:
            continue
        holes = info.get("holes") or int(c["holes"] or 18)
        par = info.get("par") or holes * 3
        par_source = "pdga" if info.get("par") else "estimated"
        feet = info.get("feet") or 0
        course_length = "short" if feet < 5000 else ("long" if feet > 7000 else "medium")
        foliage = info.get("foliage")
        wooded = bool(foliage and re.search(r"wooded|dense|forest", foliage, re.I))
        dscore = 1 + (1 if holes >= 18 else 0) + (1 if feet >= 7000 else 0) + (1 if wooded else 0)
        dscore = max(1, min(5, dscore))
        difficulty = {1: "Easy", 2: "Easy", 3: "Moderate", 4: "Hard", 5: "Very Hard"}[dscore]
        st_abbr = (c.get("state") or "XX").upper()
        state_full = STATE_ABBR.get(st_abbr, st_abbr)
        state_slug = st_abbr.lower()
        codes[st_abbr] = codes.get(st_abbr, 8999) + 1
        code = f"{st_abbr}-{codes[st_abbr]}"
        city = c["city"] or info.get("city") or ""
        hub_slug = {
            "Austin": "austin", "Denver": "denver", "Portland": "portland", "Chicago": "chicago",
            "Seattle": "seattle", "Charlotte": "charlotte", "Houston": "houston", "Phoenix": "phoenix",
            "Nashville": "nashville", "Raleigh-Durham": "raleigh", "Dallas-Fort Worth": "dallas-fort-worth",
            "Kansas City": "kansas-city", "Atlanta": "atlanta", "Cincinnati": "cincinnati",
            "Minneapolis-St. Paul": "minneapolis-st-paul",
        }.get(metro, metro.lower().replace(" ", "-"))
        entry = {
            "name": c["name"], "code": code, "city": city, "state": state_full,
            "citySlug": hub_slug, "stateSlug": state_slug, "area": city,
            "location": {"address": f"{city}, {state_full}", "lat": coords[0], "lng": coords[1]},
            "holes": holes, "par": par, "parSource": par_source, "totalFeet": feet,
            "courseLength": course_length, "difficulty": difficulty, "difficultyRating": dscore,
            "isFree": True, "greenFee": "$0", "pdgaCourseId": slug, "pdgaTier": None, "websiteUrl": None,
            "photos": [{"url": "/images/course-placeholder.svg", "alt": f"{c['name']} — photo coming soon",
                        "caption": "Placeholder — upgrade when a real photo becomes available"}],
            "heroImage": "/images/course-placeholder.svg", "thumbnail": "/images/course-placeholder.svg",
            "rating": info.get("rating") or 0.0, "reviewCount": 0,
            "tags": ["Free", {"short": "Short", "medium": "Medium", "long": "Long"}[course_length], f"{holes} Holes"],
            "amenities": {"restrooms": False, "parking": True, "water": False, "lighting": False,
                          "proShop": False, "dogFriendly": False, "cartFriendly": False,
                          "handicapAccessible": False, "camping": False},
            "facts": {"parking": "Unknown", "restrooms": "No", "proShop": "No on-site",
                      "dogs": "Unknown", "baskets": info.get("basket") or "Unknown",
                      "lighting": "None", "hours": "Unknown"},
            "yearEstablished": info.get("year"), "lastVerified": TODAY, "courseDesigner": None,
            "teeType": info.get("tee"), "basketType": info.get("basket"), "elevation": info.get("elevation"),
            "foliage": foliage,
            "aboutParagraphs": [
                f"{c['name']} is a {holes}-hole course in {city}, {state_full}"
                + (f", playing {feet:,} feet" if feet else "")
                + (f" at par {par}" if info.get("par") else " (par estimated)")
                + f". Sourced from the PDGA directory on {TODAY}."
            ],
            "holeData": [], "layoutMapUrl": None, "signatureHoleDescription": None, "localTips": None,
            "reviews": [], "tournaments": [], "nearbyCourseSlugs": [],
            "isBeginnerFriendly": False, "isWooded": wooded, "isOpen": False,
        }
        with open(COURSES + slug + ".json", "w") as f:
            json.dump(entry, f, indent=2)
            f.write("\n")
        created += 1
        print(f"  CREATED {code} {c['name']} ({city}, {state_full})", flush=True)

    print(f"\ncreated {created} PDGA-only entries", flush=True)


def metro_state(metro):
    return {"Austin": "Texas", "Denver": "Colorado", "Portland": "Oregon", "Chicago": "Illinois",
            "Seattle": "Washington", "Charlotte": "North Carolina", "Houston": "Texas",
            "Phoenix": "Arizona", "Nashville": "Tennessee", "Raleigh-Durham": "North Carolina",
            "Dallas-Fort Worth": "Texas", "Kansas City": "Missouri", "Atlanta": "Georgia",
            "Cincinnati": "Ohio", "Minneapolis-St. Paul": "Minnesota"}.get(metro, "")


if __name__ == "__main__":
    main()
