// Microsoft careers public search API.
//   https://gcsservices.careers.microsoft.com/search/api/v1/search
// Config: provider: microsoft, query: "AI" (optional)
import { getJSON, job } from './_http.mjs';

export default async function fetchMicrosoft(entry) {
  const query = entry.query || 'Artificial Intelligence';
  const url =
    'https://gcsservices.careers.microsoft.com/search/api/v1/search?' +
    new URLSearchParams({
      q: query,
      l: 'en_us',
      pg: '1',
      pgSz: '50',
      o: 'Recent',
      flt: 'true',
    }).toString();
  const data = await getJSON(url);
  const jobs = data?.operationResult?.result?.jobs;
  const list = Array.isArray(jobs) ? jobs : [];
  return list.map((j) => {
    const locs = j.properties?.locations;
    const location = Array.isArray(locs) ? locs.join('; ') : j.properties?.primaryLocation;
    return job({
      title: j.title,
      url: `https://jobs.careers.microsoft.com/global/en/job/${j.jobId}`,
      location,
      company: entry.name,
      id: j.jobId,
    });
  });
}
