/**
 * Sitemap verification — Data Hubs P1, Task 2.
 *
 * Fetches the built sitemap from a running preview server and requests every
 * URL it contains. The check FAILS if:
 *   - the sitemap itself is unreachable or empty,
 *   - any <loc> is not on https://www.findfrolf.com,
 *   - any <loc> path lacks a trailing slash,
 *   - any URL returns anything other than a direct 200 (redirects included).
 *
 * Usage:
 *   npm run build
 *   npm run preview                 # in another terminal (port 4321)
 *   node scripts/check-sitemap.ts [baseUrl]
 *
 * baseUrl defaults to http://localhost:4321 (astro preview).
 */

const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/+$/, '');
const CANONICAL_ORIGIN = 'https://www.findfrolf.com';
const CONCURRENCY = 20;
const TIMEOUT_MS = 15_000;

function fail(message: string): never {
  console.error(`\n✗ check-sitemap: ${message}`);
  process.exit(1);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  // 1. Fetch the built sitemap from the preview server.
  let xml: string;
  try {
    const res = await fetchWithTimeout(`${base}/sitemap.xml`);
    if (res.status !== 200) {
      fail(`sitemap.xml returned HTTP ${res.status} at ${base}/sitemap.xml`);
    }
    xml = await res.text();
  } catch (err) {
    fail(
      `could not fetch ${base}/sitemap.xml — is the preview server running? ` +
        `(${(err as Error).message})`,
    );
  }

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (locs.length === 0) fail('sitemap contained no <loc> entries');

  // 2. Static assertions on every URL: www host + trailing slash.
  const badShape: string[] = [];
  for (const loc of locs) {
    let parsed: URL;
    try {
      parsed = new URL(loc);
    } catch {
      badShape.push(`${loc} (unparseable)`);
      continue;
    }
    if (parsed.origin !== CANONICAL_ORIGIN) {
      badShape.push(`${loc} (origin is ${parsed.origin}, want ${CANONICAL_ORIGIN})`);
    }
    if (!parsed.pathname.endsWith('/')) {
      badShape.push(`${loc} (no trailing slash)`);
    }
  }
  if (badShape.length > 0) {
    console.error('✗ Malformed sitemap URLs:');
    for (const b of badShape) console.error(`  - ${b}`);
    fail(`${badShape.length} malformed URL(s)`);
  }

  // 3. Request every URL against the preview server, redirects disallowed.
  const failures: string[] = [];
  let checked = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < locs.length) {
      const loc = locs[cursor++];
      const path = new URL(loc).pathname;
      const target = `${base}${path}`;
      try {
        const res = await fetchWithTimeout(target, { redirect: 'manual' });
        // Drain the body so the connection can be reused.
        await res.arrayBuffer();
        if (res.status >= 300 && res.status < 400) {
          failures.push(
            `${path} → HTTP ${res.status} (redirect to ${res.headers.get('location') ?? '?'})`,
          );
        } else if (res.status !== 200) {
          failures.push(`${path} → HTTP ${res.status}`);
        }
      } catch (err) {
        failures.push(`${path} → fetch error: ${(err as Error).message}`);
      }
      checked++;
      if (checked % 100 === 0 || checked === locs.length) {
        process.stdout.write(`\r  checked ${checked}/${locs.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  process.stdout.write('\n');

  if (failures.length > 0) {
    console.error('✗ Sitemap URL failures:');
    for (const f of failures) console.error(`  - ${f}`);
    fail(`${failures.length} of ${locs.length} URLs did not return a direct 200`);
  }

  console.log(`✓ check-sitemap: all ${locs.length} URLs are www + trailing-slash and return 200 directly.`);
}

await main();
