// Eightfold AI career platform (Netflix, Uber, and many others).
//   https://{host}/api/apply/v2/jobs?domain={domain}&start=0&num=50&sort_by=timestamp
// Config: provider: eightfold, host: explore.jobs.netflix.net, domain: netflix.com
// Phase-2 / best-effort: endpoints + field names vary per tenant, so this fails
// soft. Verify with `--dry-run --company <name>` before relying on it.
import { getJSON, job } from './_http.mjs';

export default async function fetchEightfold(entry) {
  const { host, domain } = entry;
  if (!host || !domain) throw new Error('eightfold entry needs host and domain');
  const url =
    `https://${host}/api/apply/v2/jobs?` +
    new URLSearchParams({
      domain,
      start: '0',
      num: '50',
      sort_by: 'timestamp',
    }).toString();
  const data = await getJSON(url);
  const list = Array.isArray(data?.positions) ? data.positions : [];
  return list.map((j) =>
    job({
      title: j.name,
      url: j.canonicalPositionUrl || (j.id ? `https://${host}/careers/job/${j.id}` : ''),
      location: j.location || (Array.isArray(j.locations) ? j.locations.join('; ') : ''),
      company: entry.name,
      id: j.id || j.canonicalPositionUrl,
    })
  );
}
