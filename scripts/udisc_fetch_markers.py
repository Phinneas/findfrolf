#!/usr/bin/env python3
"""Fetch UDisc's all-map-markers.csv and inspect its schema."""
import sys
from scrapling.fetchers import DynamicFetcher

URL = "https://udisc.com/api/courses/all-map-markers.csv"
OUT = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_markers.csv"


def page_action(page):
    # The CSV is a plain resource; just wait for it to settle.
    page.wait_for_timeout(2000)


resp = DynamicFetcher.fetch(
    URL,
    headless=True,
    page_action=page_action,
    timeout=60000,
    wait=1500,
    google_search=False,
)
print("status:", resp.status)
print("content-type:", (resp.headers or {}).get("content-type"))
body = resp.body
print("bytes:", len(body))
if not body:
    print("EMPTY BODY")
    sys.exit(1)
with open(OUT, "wb") as f:
    f.write(body)
print("saved:", OUT)

text = body.decode("utf-8", "replace")
lines = text.splitlines()
print("lines:", len(lines))
for i, line in enumerate(lines[:8]):
    print(f"[{i}] {line[:300]}")
print("...")
print("last line:", lines[-1][:300] if lines else "")
