// HRMOS (hrmos.co) — dominant Japanese ATS (by BizReach). Server-rendered, so a
// plain GET + parse works (no auth, no browser).
//   https://hrmos.co/pages/{slug}/jobs  → <a href=".../pages/{slug}/jobs/{id}">Title …</a>
// Config: provider: hrmos, slug: <company>
// Note: many JP listings are Japanese-titled — the filter carries a few JP
// engineering keywords so these still match.
import { getText, job } from './_http.mjs';

export default async function fetchHrmos(entry) {
  const slug = entry.slug;
  const html = await getText(`https://hrmos.co/pages/${slug}/jobs`);
  const re = new RegExp(`<a[^>]*href="([^"]*\\/pages\\/${slug}\\/jobs\\/(\\d+))"[^>]*>([\\s\\S]*?)<\\/a>`, 'g');
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[1].startsWith('http') ? m[1] : 'https://hrmos.co' + m[1];
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    // Anchor text is "Title …description"; cut at the recruitment-background marker.
    let t = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    t = t.split(/募集背景|募集概要|Recruitment Background|Job Description|職務内容|業務内容|仕事内容|Thank you/)[0].trim();
    if (t.length > 90) t = t.slice(0, 90);
    if (!t) continue;
    out.push(job({ title: t, url, location: '', company: entry.name, id }));
  }
  return out;
}
