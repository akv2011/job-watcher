// Kula (careers.kula.ai) — AI-native ATS. Public internal JSON, no auth.
//   /api/internal/ats_job_posts?accountName={slug}&page=1&type=ats_job_post.index&items=99
// Config: provider: kula, slug: <accountName>
import { getJSON, job } from './_http.mjs';

export default async function fetchKula(entry) {
  const slug = entry.slug;
  const data = await getJSON(
    `https://careers.kula.ai/api/internal/ats_job_posts?accountName=${slug}&page=1&type=ats_job_post.index&items=99`
  );
  const list = Array.isArray(data?.data) ? data.data : [];
  return list.map((p) => {
    const offices = p.ats_job?.offices;
    let location = '';
    if (Array.isArray(offices)) {
      location = offices
        .map((o) => (typeof o === 'string' ? o : o?.name || o?.city || o?.location || ''))
        .filter(Boolean)
        .join('; ');
    }
    if (!location && p.ats_job?.workplace) location = p.ats_job.workplace;
    return job({
      title: p.title,
      url: `https://careers.kula.ai/${slug}/${p.id}/`,
      location,
      company: entry.name,
      id: p.id,
    });
  });
}
