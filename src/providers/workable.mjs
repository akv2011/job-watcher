// Workable public jobs API (no auth).
//   POST https://apply.workable.com/api/v3/accounts/{slug}/jobs
// Config: provider: workable, slug: <account slug>
import { postJSON, job } from './_http.mjs';

export default async function fetchWorkable(entry) {
  const slug = entry.slug;
  const data = await postJSON(
    `https://apply.workable.com/api/v3/accounts/${slug}/jobs`,
    { query: '', location: [], department: [], worktype: [], remote: [] }
  );
  const list = Array.isArray(data?.results) ? data.results : [];
  return list.map((j) => {
    const loc = j.location || {};
    const location =
      [loc.city, loc.region, loc.country].filter(Boolean).join(', ') ||
      (loc.remote ? 'Remote' : '');
    return job({
      title: j.title,
      url: j.url || `https://apply.workable.com/${slug}/j/${j.shortcode}/`,
      location,
      company: entry.name,
      id: j.shortcode || j.id,
    });
  });
}
