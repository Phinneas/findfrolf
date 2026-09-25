/**
 * Minimal Cloudflare D1 REST client (docs/HANDOFF-data-layer.md §7).
 *
 * Uses the D1 HTTP API so scripts can read/write D1 without `wrangler` at
 * runtime. Credentials come from `.env`:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_D1_DATABASE_ID
 *   CLOUDFLARE_API_TOKEN
 */

export function d1Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error(
      'Missing Cloudflare D1 credentials. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN in .env.',
    );
  }
  return { accountId, databaseId, token };
}

/**
 * Run a single SQL statement against D1 and return the result rows.
 * Throws with the Cloudflare error payload when the request fails.
 */
export async function d1Query(sql, params = []) {
  const { accountId, databaseId, token } = d1Config();
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(json.errors || json.messages || json)}`);
  }
  const first = json.result?.[0];
  return first?.results ?? [];
}
