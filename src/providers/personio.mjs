// Personio (jobs.personio.de / .com) — public JSON feed, no auth.
//   https://{slug}.jobs.personio.{tld}/search.json  → [{ id, name, office, ... }]
// Config: provider: personio, slug: <subdomain>, tld: de|com (default de)
import { getJSON, job } from './_http.mjs';

export default async function fetchPersonio(entry) {
  const slug = entry.slug;
  const tld = entry.tld || 'de';
  const base = `https://${slug}.jobs.personio.${tld}`;
  const data = await getJSON(`${base}/search.json`);
  const list = Array.isArray(data) ? data : [];
  return list.map((j) =>
    job({
      title: j.name,
      url: `${base}/job/${j.id}`,
      location: j.office || '',
      company: entry.name,
      id: j.id,
    })
  );
}
