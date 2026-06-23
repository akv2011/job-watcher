// "careers-home" JSON API (Radancy/iCIMS-backed careers sites, e.g. AMD).
//   https://{host}/api/jobs?page=1&limit=50&sortBy=posted_date[&keywords=...]
// Returns { jobs: [{ data: { title, slug, req_id, city/state/country, ... } }] }
// Config: provider: careershome, host: careers.amd.com, keywords: "engineer"
import { getJSON, job } from './_http.mjs';

export default async function fetchCareersHome(entry) {
  const { host, keywords = '' } = entry;
  if (!host) throw new Error('careershome entry needs host');
  const url =
    `https://${host}/api/jobs?` +
    new URLSearchParams({
      page: '1',
      limit: '50',
      sortBy: 'posted_date',
      ...(keywords ? { keywords } : {}),
    }).toString();
  const data = await getJSON(url);
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.map(({ data: d }) =>
    job({
      title: d.title,
      url: `https://${host}/careers-home/jobs/${d.slug}`,
      location: d.full_location || [d.city, d.state, d.country].filter(Boolean).join(', '),
      company: entry.name,
      id: d.req_id || d.slug,
    })
  );
}
