// Eightfold AI career platform, via its "pcsx" search API (Microsoft, Qualcomm,
// and many others). Public JSON, no auth — works over plain HTTP for tenants
// that don't bot-block (some, e.g. Netflix/Uber, return 403 and need a browser).
//   https://{host}/api/pcsx/search?domain={domain}&query=...&sort_by=timestamp
// Config: provider: eightfold, host: careers.qualcomm.com, domain: qualcomm.com, query: "engineer"
import { getJSON, job } from './_http.mjs';

export default async function fetchEightfold(entry) {
  const { host, domain, query = '' } = entry;
  if (!host || !domain) throw new Error('eightfold entry needs host and domain');
  const url =
    `https://${host}/api/pcsx/search?` +
    new URLSearchParams({
      domain,
      query,
      location: '',
      start: '0',
      num: '50',
      sort_by: 'timestamp',
    }).toString();
  const data = await getJSON(url);
  const positions = data?.data?.positions || data?.positions || [];
  const baseUrl = `https://${host}`;
  return positions.map((p) => {
    const rel = p.positionUrl || `/careers/job/${p.id}`;
    return job({
      title: p.name,
      url: rel.startsWith('http') ? rel : baseUrl + rel,
      location: Array.isArray(p.locations) ? p.locations.join('; ') : p.location || '',
      company: entry.name,
      id: p.id,
    });
  });
}
