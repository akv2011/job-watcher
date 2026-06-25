// SmartRecruiters public posting API (no auth).
//   https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=100
// Config: provider: smartrecruiters, slug: <company identifier>
import { getJSON, job } from './_http.mjs';

export default async function fetchSmartRecruiters(entry) {
  const slug = entry.slug;
  const data = await getJSON(
    `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`
  );
  const list = Array.isArray(data?.content) ? data.content : [];
  return list.map((p) => {
    const loc = p.location || {};
    const location = [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
    return job({
      title: p.name,
      url: `https://jobs.smartrecruiters.com/${slug}/${p.id}`,
      location,
      company: entry.name,
      id: p.id || p.uuid,
    });
  });
}
