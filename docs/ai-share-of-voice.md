# AI Share of Voice — Tracking Log

Started Q4 2026. This log tracks how often FindFrolf gets cited by AI answer
engines (ChatGPT, Google AI Overviews, Perplexity, etc.) for our target
keywords — and, critically, **which content element** is getting cited. The
point is to answer one question: are the city comparison tables or the blog/city
FAQs what actually moves the needle?

## What "AI share of voice" means here

Classic SEO measures SERP rank. This measures something adjacent: when someone
asks an AI a disc-golf question, does it cite FindFrolf — or does it cite
UDisc, PDGA, or DGCR? For a young site competing with those three, "cited at
all" is the first milestone; "cited for the right reason" is the second.

## What we track

### Target keywords (and the element we expect to win each)

| Keyword / question | Expected cited element |
|---|---|
| "best disc golf courses in Austin" | City `CourseRegister` semantic table |
| "disc golf in Denver / Chicago / Seattle / …" | City page (table + ItemList schema) |
| "how do you score in disc golf" | Blog FAQ (`FAQPage` → Question/Answer) |
| "what is par in disc golf" | Blog FAQ |
| "out of bounds disc golf rules" | Rules post H2 definitional sentence |
| "what's a good disc golf score" | Scoring post H2 definitional sentence |

### The two hypotheses to test

1. **H1 — city tables:** the semantic `<table>` (Course / Holes / Par / Length /
   Difficulty / Cost / Rating) gets cited for "best courses in X" queries,
   because it gives an extractor clean row data.
2. **H2 — FAQ schema:** `FAQPage` JSON-LD + liftable one-sentence H2 answers get
   cited for "how do you / what is" queries.

## Methodology

Per quarterly check, for each keyword:

1. Ask the plain question in 2–3 answer engines (ChatGPT, Google AI Overviews,
   Perplexity — pick whichever two are cheapest to run that quarter).
2. Record, in the table below: date, query, engine, whether FindFrolf was cited,
   which page + element (table row / FAQ answer / H2 sentence), and who was
   cited instead if not us.
3. Add one line per (keyword × engine) that you actually ran. Empty rows are
   fine — this log is honest about what was measured.

## Quarterly log

### Q4 2026 (baseline)

| Date | Query | Engine | FindFrolf cited? | Cited element | Competitor cited |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

### Q1 2027

| Date | Query | Engine | FindFrolf cited? | Cited element | Competitor cited |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

### Q2 2027

| Date | Query | Engine | FindFrolf cited? | Cited element | Competitor cited |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## Notes

- **Baseline context (Q4 2026 start):** the three structural levers that should
  move this metric shipped in September 2026 — the semantic city
  `CourseRegister` tables, city `FAQPage` JSON-LD, and liftable definitional
  sentences in the beginner/rules posts. Expect near-zero citation for at least
  a quarter or two; this log exists to measure the *trend*, not to judge a
  single quarter harshly.
- **Confounding factor:** UDisc, PDGA, and DGCR have years of head start and
  much deeper domain authority. Being *cited alongside them* (co-citation) is a
  realistic intermediate goal before winning the sole citation.
- If a quarter comes back all-blank because no engine cited us, that is itself
  data — record it rather than leaving the table empty.
