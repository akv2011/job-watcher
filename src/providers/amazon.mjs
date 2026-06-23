// Amazon jobs public search JSON.
//   https://www.amazon.jobs/en/search.json
// Config: provider: amazon, query: "machine learning" (optional)
import { getJSON, job } from './_http.mjs';

export default async function fetchAmazon(entry) {
  const query = entry.query || 'machine learning';
  const url =
    'https://www.amazon.jobs/en/search.json?' +
    new URLSearchParams({
      base_query: query,
      result_limit: '100',
      sort: 'recent',
      offset: '0',
    }).toString();
  const data = await getJSON(url);
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.map((j) =>
    job({
      title: j.title,
      url: j.job_path ? `https://www.amazon.jobs${j.job_path}` : j.url_next_step,
      location: j.normalized_location || j.location,
      company: entry.name,
      id: j.id_icims || j.job_path,
    })
  );
}
