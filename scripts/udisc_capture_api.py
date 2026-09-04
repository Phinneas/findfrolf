#!/usr/bin/env python3
"""Capture UDisc directory XHR to discover the courses-list API."""
import json
import sys
from scrapling.fetchers import DynamicFetcher

URL = sys.argv[1] if len(sys.argv) > 1 else "https://udisc.com/courses?latitude=47.6062&longitude=-122.3321"


def page_action(page):
    for _ in range(5):
        page.wait_for_timeout(1500)
        # try scrolling the list container if present
        page.evaluate("""() => {
            const list = document.querySelector('[class*="list"], main');
            if (list) list.scrollTop = list.scrollHeight;
            window.scrollTo(0, document.body.scrollHeight);
        }""")


resp = DynamicFetcher.fetch(
    URL,
    headless=True,
    capture_xhr=r"http",
    page_action=page_action,
    timeout=60000,
    wait=2000,
    google_search=False,
)

print("status:", resp.status)
print("final url:", resp.url)
print("captured_xhr count:", len(resp.captured_xhr))
skip = ("mapbox", "intercom", "sentry", "google", "s3", "stripe", "newrelic", "amplitude")
for i, x in enumerate(resp.captured_xhr):
    url = x.url
    if any(s in url for s in skip):
        continue
    body = x.body[:500].decode("utf-8", "replace")
    ctype = (x.headers or {}).get("content-type", "")
    print(f"\n--- xhr {i} ---")
    print("url:", url[:250])
    print("content-type:", ctype[:80])
    print("body sample:", body[:400])
