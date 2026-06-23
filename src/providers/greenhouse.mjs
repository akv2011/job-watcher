// Greenhouse public board API: zero auth, clean JSON.
//   https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
import { getJSON, job } from './_http.mjs';

export default async function fetchGreenhouse(entry) {
  const slug = entry.slug;
  const data = await getJSON(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=false`
  );
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.map((j) =>
    job({
      title: j.title,
      url: j.absolute_url,
      location: j.location?.name,
      company: entry.name,
      id: j.id,
    })
  );
}
