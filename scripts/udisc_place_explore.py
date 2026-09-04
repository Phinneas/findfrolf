#!/usr/bin/env python3
"""Explore a UDisc place (city) page: dump course links + body text."""
import sys
from scrapling.fetchers import DynamicFetcher

URL = sys.argv[1] if len(sys.argv) > 1 else "https://udisc.com/places/us/washington/seattle-wa"


def page_action(page):
    # scroll to bottom repeatedly to trigger lazy lists
    for _ in range(6):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1200)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)


resp = DynamicFetcher.fetch(
    URL, headless=True, page_action=page_action, timeout=60000, wait=1500, google_search=False
)

print("status:", resp.status)
print("final url:", resp.url)
text = resp.get_all_text()
print("=== body text (first 2500) ===")
print(text[:2500])

# course links
links = resp.css("a[href*='/courses/']")
print("\n=== course links ===")
seen = set()
for a in links:
    href = a.attrib.get("href", "")
    if href and not any(x in href for x in ("/add", "/edit", "/map", "/photos", "/reviews", "/leaderboard", "/v2/", "/caddie", "#", "?")):
        if href not in seen:
            seen.add(href)
            print(href, "|", a.get_all_text().strip()[:60])

print("\ntotal unique course links:", len(seen))
