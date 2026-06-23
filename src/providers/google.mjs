// Google careers public search API.
//   https://careers.google.com/api/v3/search/
// Config: provider: google, query: "AI" (optional)
// Note: Google occasionally adjusts this endpoint; provider fails soft (returns
// [] on error) so the rest of the run is unaffected.
import { getJSON, job } from './_http.mjs';

export default async function fetchGoogle(entry) {
  const query = entry.query || 'AI';
  const url =
    'https://careers.google.com/api/v3/search/?' +
    new URLSearchParams({
      q: query,
      page_size: '100',
      sort_by: 'date',
    }).toString();
  const data = await getJSON(url);
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.map((j) => {
    const loc = Array.isArray(j.locations) && j.locations.length
      ? j.locations.map((l) => l.display).filter(Boolean).join('; ')
      : '';
    // apply_url is canonical; otherwise build from the job id.
    const id = j.id || j.job_id || '';
    const url = j.apply_url || (id ? `https://careers.google.com/jobs/results/${String(id).replace(/^jobs\//, '')}/` : '');
    return job({ title: j.title, url, location: loc, company: entry.name, id });
  });
}
