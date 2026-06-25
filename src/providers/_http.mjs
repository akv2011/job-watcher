// Shared HTTP helpers. Node 18+ ships a global `fetch`.
//
// Every provider must be resilient: a single bad endpoint (rate-limited,
// changed schema, anti-bot block) must never crash the whole run. Providers
// catch their own errors and return [] — the runner logs and moves on.

const DEFAULT_TIMEOUT_MS = 30_000;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 job-watcher';

export async function getJSON(url, { headers = {}, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  return requestJSON(url, { method: 'GET', headers, timeout });
}

export async function postJSON(url, body, { headers = {}, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  return requestJSON(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    timeout,
  });
}

// Fetch raw text (for SSR HTML scraping providers).
export async function getText(url, { headers = {}, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  return withRetry(async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html', ...headers },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  });
}

// Retry once on failure (transient 5xx, timeouts, network blips) so a flaky
// board (e.g. Truist's intermittent HTTP 500) doesn't trigger a false "broken"
// alert. Most second attempts succeed.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, attempts = 2, backoffMs = 1500) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await sleep(backoffMs);
    }
  }
  throw last;
}

async function requestJSON(url, { method, headers, body, timeout }) {
  return withRetry(async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        method,
        headers: { accept: 'application/json', 'user-agent': UA, ...headers },
        body,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  });
}

// Normalize any provider row into the canonical job shape used everywhere.
export function job({ title, url, location, company, id }) {
  return {
    title: (title || '').trim(),
    url: (url || '').trim(),
    location: (location || '').trim(),
    company,
    id: id != null ? String(id) : (url || '').trim(),
  };
}
