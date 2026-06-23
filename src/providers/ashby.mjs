// Ashby public posting API: zero auth, clean JSON.
//   https://api.ashbyhq.com/posting-api/job-board/{slug}
import { getJSON, job } from './_http.mjs';

export default async function fetchAshby(entry) {
  const slug = entry.slug;
  const data = await getJSON(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=false`
  );
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.map((j) =>
    job({
      title: j.title,
      // jobUrl is the public posting URL; fall back to the apply URL.
      url: j.jobUrl || j.applyUrl,
      location: j.location || j.locationName,
      company: entry.name,
      id: j.id,
    })
  );
}
