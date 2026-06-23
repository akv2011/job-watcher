// Lever public postings API: zero auth, clean JSON.
//   https://api.lever.co/v0/postings/{slug}?mode=json
import { getJSON, job } from './_http.mjs';

export default async function fetchLever(entry) {
  const slug = entry.slug;
  const data = await getJSON(
    `https://api.lever.co/v0/postings/${slug}?mode=json`
  );
  const jobs = Array.isArray(data) ? data : [];
  return jobs.map((j) =>
    job({
      title: j.text,
      url: j.hostedUrl || j.applyUrl,
      location: j.categories?.location,
      company: entry.name,
      id: j.id,
    })
  );
}
