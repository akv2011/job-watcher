// BambooHR public careers list (no auth).
//   https://{slug}.bamboohr.com/careers/list
// Config: provider: bamboohr, slug: <company subdomain>
import { getJSON, job } from './_http.mjs';

export default async function fetchBambooHr(entry) {
  const slug = entry.slug;
  const data = await getJSON(`https://${slug}.bamboohr.com/careers/list`);
  const list = Array.isArray(data?.result) ? data.result : [];
  return list.map((item) => {
    const loc = item.location && typeof item.location === 'object' ? item.location : {};
    const location =
      [loc.city, loc.state, loc.country].filter(Boolean).join(', ') ||
      (typeof item.location === 'string' ? item.location : item.atsLocation || '');
    return job({
      title: item.jobOpeningName || item.title,
      url: `https://${slug}.bamboohr.com/careers/${item.id}`,
      location,
      company: entry.name,
      id: item.id,
    });
  });
}
