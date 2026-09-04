#!/usr/bin/env python3
"""Investigate directory infinite-scroll: find scroll container + pagination XHR."""
import json
from scrapling.fetchers import DynamicFetcher

URL = "https://udisc.com/courses?latitude=47.6062&longitude=-122.3321"


def page_action(page):
    # 1) find scrollable containers
    info = page.evaluate("""() => {
        const els = [...document.querySelectorAll('div,main,section,ul')].filter(e => {
            const cs = getComputedStyle(e);
            return e.scrollHeight > e.clientHeight + 80 && (cs.overflowY === 'auto' || cs.overflowY === 'scroll');
        });
        return els.map(e => ({tag: e.tagName, cls: String(e.className).slice(0,80),
            sh: e.scrollHeight, ch: e.clientHeight})).sort((a,b)=>b.sh-a.sh).slice(0,6);
    }""")
    print("SCROLLABLE:", json.dumps(info, indent=1))

    # 2) scroll the biggest container repeatedly
    for i in range(12):
        n = page.evaluate("""() => {
            const els = [...document.querySelectorAll('div,main,section,ul')].filter(e => e.scrollHeight > e.clientHeight + 80);
            els.sort((a,b)=>b.scrollHeight-a.scrollHeight);
            for (const e of els.slice(0,3)) { e.scrollTop = e.scrollHeight; }
            window.scrollTo(0, document.body.scrollHeight);
            return document.querySelectorAll('a[href^="/courses/"]').length;
        }""")
        page.wait_for_timeout(1200)
        print(f"scroll {i}: course links in DOM = {n}")


resp = DynamicFetcher.fetch(
    URL,
    headless=True,
    capture_xhr=r"udisc\.com/api|udisc\.com/__",
    page_action=page_action,
    timeout=90000,
    wait=1500,
    google_search=False,
)

print("\n=== captured udisc api xhr ===")
for i, x in enumerate(resp.captured_xhr):
    print(f"[{i}] {x.url[:250]}  (bytes={len(x.body)})")
    if "api" in x.url and "csv" not in x.url:
        print("     body:", x.body[:300].decode("utf-8", "replace")[:300])

# final card count from resp html
from scrapling.parser import Selector
sel = resp.selector if hasattr(resp, "selector") else resp
links = sel.css("a[href^='/courses/']")
print("\nfinal course links:", len(links))
