// Recruitee public offers API (no auth).
//   https://{slug}.recruitee.com/api/offers/
// Config: provider: recruitee, slug: <company subdomain>
import { getJSON, job } from './_http.mjs';

export default async function fetchRecruitee(entry) {
  const slug = entry.slug;
  const data = await getJSON(`https://${slug}.recruitee.com/api/offers/`);
  const list = Array.isArray(data?.offers) ? data.offers : [];
  return list.map((o) => {
    const location = o.location || [o.city, o.country].filter(Boolean).join(', ');
    return job({
      title: o.title,
      url: o.careers_url || o.careers_apply_url || `https://${slug}.recruitee.com/o/${o.slug}`,
      location,
      company: entry.name,
      id: o.id || o.slug,
    });
  });
}
