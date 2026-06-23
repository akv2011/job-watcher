// Microsoft careers — backed by Eightfold's "pcsx" search API.
// The public careers SPA (apply.careers.microsoft.com) calls this; it works
// over plain HTTP with no auth. (The old gcsservices.careers.microsoft.com
// host blocks non-browser clients — this one does not.)
//   https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=...&sort_by=timestamp
// Config: provider: microsoft, query: "AI" (optional)
import { getJSON, job } from './_http.mjs';

export default async function fetchMicrosoft(entry) {
  const query = entry.query || 'AI';
  const url =
    'https://apply.careers.microsoft.com/api/pcsx/search?' +
    new URLSearchParams({
      domain: 'microsoft.com',
      query,
      location: '',
      start: '0',
      num: '50',
      sort_by: 'timestamp',
    }).toString();
  const data = await getJSON(url);
  const positions = data?.data?.positions;
  const list = Array.isArray(positions) ? positions : [];
  return list.map((p) =>
    job({
      title: p.name,
      // positionUrl is absolute when present; otherwise build the canonical link.
      url: p.positionUrl || `https://jobs.careers.microsoft.com/global/en/job/${p.id}`,
      location: Array.isArray(p.locations) ? p.locations.join('; ') : '',
      company: entry.name,
      id: p.id,
    })
  );
}
