// HERP (herp.careers) — Japanese ATS, server-rendered like HRMOS.
//   https://herp.careers/v1/{slug}  → <a href="/v1/{slug}/{jobId}">Title …</a>
// Config: provider: herp, slug: <company>  (note: slug may differ from name, e.g. Ubie = ubiehr)
import { getText, job } from './_http.mjs';

export default async function fetchHerp(entry) {
  const slug = entry.slug;
  const html = await getText(`https://herp.careers/v1/${slug}`);
  const re = new RegExp(`<a[^>]*href="([^"]*\\/v1\\/${slug}\\/([A-Za-z0-9_-]{6,}))"[^>]*>([\\s\\S]*?)<\\/a>`, 'g');
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    let t = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    t = t.split(/募集背景|募集概要|職務内容|業務内容|仕事内容|Recruitment Background/)[0].trim();
    if (t.length > 90) t = t.slice(0, 90);
    // skip placeholder/redirect entries
    if (!t || /最新の募集状況|以下のリンク/.test(t)) continue;
    out.push(job({ title: t, url: m[1].startsWith('http') ? m[1] : 'https://herp.careers' + m[1], location: '', company: entry.name, id }));
  }
  return out;
}
