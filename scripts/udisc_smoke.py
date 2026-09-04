#!/usr/bin/env python3
"""Smoke test: render a UDisc course page with Scrapling's DynamicFetcher.

Confirms (1) the browser launches against the cached chromium-1234 build,
(2) the React app renders, and (3) the per-hole grid parses via Scrapling's
Selector API (reusing the proven `div.grid.grid-cols-10` structure).
"""
import sys

from scrapling.fetchers import DynamicFetcher

URL = sys.argv[1] if len(sys.argv) > 1 else "https://udisc.com/courses/old-settlers-park-dgc-GDmw"


def page_action(page):
    """Scroll the Layouts section into view and wait for the hole grid."""
    page.evaluate("""() => {
        const el = document.querySelector('section#layouts');
        if (el) el.scrollIntoView({block:'center'});
    }""")
    for _ in range(30):
        page.wait_for_timeout(1000)
        n = page.evaluate("document.querySelectorAll('div.grid.grid-cols-10').length")
        if n >= 2:
            break
    return n


resp = DynamicFetcher.fetch(
    URL,
    headless=True,
    page_action=page_action,
    timeout=60000,
    wait=1500,
    google_search=False,
)

print("status:", resp.status)
print("final url:", resp.url)
print("html length:", len(resp.html_content))

# body text sanity
text = resp.get_all_text()
print("body text length:", len(text))
print("has 'Layouts':", "Layouts" in text)
print("has 'Holes':", "Holes" in text)

# parse hole grid via Scrapling Selector
grids = resp.css("div.grid.grid-cols-10")
print("grid-cols-10 blocks:", len(grids))
holes = []
for g in grids:
    kids = g.css(":scope > div")
    for cell in kids[1:]:
        divs = cell.css(":scope > div")
        if len(divs) < 3:
            continue
        hole = int(divs[0].get_all_text().strip() or 0)
        dist = int("".join(ch for ch in divs[1].get_all_text() if ch.isdigit()) or 0)
        par = int("".join(ch for ch in divs[2].get_all_text() if ch.isdigit()) or 0)
        if hole and dist and par:
            holes.append((hole, dist, par))

seen, dedup = set(), []
for h in sorted(holes):
    if h[0] not in seen:
        seen.add(h[0])
        dedup.append(h)

print("parsed holes:", len(dedup))
print("sum par:", sum(h[2] for h in dedup))
print("sum dist:", sum(h[1] for h in dedup))
print("first 3:", dedup[:3])
print("last 3:", dedup[-3:])
