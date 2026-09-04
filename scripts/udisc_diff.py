#!/usr/bin/env python3
"""Diff UDisc metro cards against PDGA course lists to find UDisc-only courses.

Reads docs/metro-course-counts.md (PDGA names) and udisc_metro_cards.json (UDisc
cards from the sweep). Normalizes names and matches conservatively (exact +
containment). Emits a readable report and udisc_only.json of UDisc-only candidates.

Usage: python scripts/udisc_diff.py [--report]
"""
import json
import re
import sys

DOCS = "/Users/chesterbeard/CascadeProjects/findfrolf/docs/metro-course-counts.md"
CARDS = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_metro_cards.json"
OUT = "/Users/chesterbeard/CascadeProjects/findfrolf/udisc_only.json"


def norm_name(s):
    s = s.lower()
    s = s.replace("@", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


STOP = {
    "disc", "golf", "course", "dgc", "dg", "park", "the", "at", "memorial",
    "community", "discgolfpark", "discgolf", "club", "dgr",
}


def sig(s):
    """Significant tokens of a normalized name."""
    return {t for t in norm_name(s).split() if t not in STOP and len(t) > 1}


def core(s):
    return " ".join(sorted(sig(s)))


def match_score(n, k):
    """Return a match score (0..1) between a normalized UDisc name and PDGA norm name."""
    a, b = sig(n), sig(k)
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if a == b:
        return 1.0
    if inter >= 2 and (a <= b or b <= a):
        return 0.9
    jac = inter / len(a | b)
    return jac


def containment_hit(n, pdga_cores):
    # exact containment on the core (sorted token) string
    c = core(n)
    for k, v in pdga_cores.items():
        if c and (c in k or k in c):
            return v
    return None


def parse_pdga(docs):
    metro_names = {}
    cur = None
    for line in docs.splitlines():
        m = re.match(r"^### (.+) \(\d+\)", line)
        if m:
            cur = m.group(1).strip()
            metro_names[cur] = []
            continue
        m = re.match(r"^- (.+?) — ", line)
        if m and cur:
            metro_names[cur].append(m.group(1).strip())
    return metro_names


def main():
    docs = open(DOCS, encoding="utf-8").read()
    pdga = parse_pdga(docs)
    cards = json.load(open(CARDS))

    # existing course entries (name + slug) to cross-reference
    import os
    COURSES = "/Users/chesterbeard/CascadeProjects/findfrolf/src/content/courses/"
    existing_slugs = set()
    existing_names = {}
    for fn in os.listdir(COURSES):
        if fn.endswith(".json"):
            try:
                d = json.load(open(os.path.join(COURSES, fn)))
                existing_slugs.add(fn[:-5])
                existing_names[fn[:-5]] = sig(d.get("name", ""))
            except Exception:
                pass

    out = {}
    report_lines = []
    for metro, pdga_names in pdga.items():
        udisc_cards = cards.get(metro, {}).get("cards", [])

        only = []
        matched = []
        already = []
        for c in udisc_cards:
            slug = c["slug"].split("/")[-1]
            # cross-ref existing entries
            if slug in existing_slugs:
                already.append((c["name"], "already entered (slug)"))
                continue
            sn = sig(c["name"])
            if sn and any(sn == ex for ex in existing_names.values()):
                already.append((c["name"], "already entered (name)"))
                continue

            n = norm_name(c["name"])
            best = 0.0
            best_name = None
            for pname in pdga_names:
                sc = match_score(n, pname)
                if sc > best:
                    best, best_name = sc, pname
            if best >= 0.55:
                matched.append((c["name"], best_name, round(best, 2)))
            else:
                only.append(c)

        out[metro] = only
        report_lines.append(f"\n=== {metro}: {len(udisc_cards)} UDisc, {len(pdga_names)} PDGA | {len(matched)} matched, {len(already)} already-entered, {len(only)} UDisc-only ===")
        for c in sorted(only, key=lambda x: x["name"]):
            report_lines.append(f"  ONLY  {c['name']} | {c['city']}, {c['state']} | {c['slug']}")

    json.dump(out, open(OUT, "w"), indent=1)
    total_only = sum(len(v) for v in out.values())
    print("wrote", OUT, f"(total UDisc-only candidates: {total_only})")
    print("\n".join(report_lines))


if __name__ == "__main__":
    main()
