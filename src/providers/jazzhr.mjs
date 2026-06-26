// JazzHR ({slug}.applytojob.com) — server-rendered job board, no auth.
//   https://{slug}.applytojob.com/  → <a href="/apply/{code}/{title-slug}">Title</a>
// Config: provider: jazzhr, slug: <subdomain>
import { getText, job } from './_http.mjs';

export default async function fetchJazzhr(entry) {
  const slug = entry.slug;
  const html = await getText(`https://${slug}.applytojob.com/`);
  const re = /<a[^>]*href="(?:https?:\/\/[a-z.]*applytojob\.com)?(\/apply\/[A-Za-z0-9]+\/[A-Za-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = m[1];
    const code = path.split('/')[2];
    if (seen.has(code)) continue;
    seen.add(code);
    const t = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    out.push(job({ title: t, url: `https://${slug}.applytojob.com${path}`, location: '', company: entry.name, id: code }));
  }
  return out;
}
