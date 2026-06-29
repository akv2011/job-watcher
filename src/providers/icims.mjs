// iCIMS — widely-used ATS. The career portal is JS/iframe, but the in-iframe
// search returns server-rendered HTML with job links (plain HTTP, no auth).
//   https://careers-{slug}.icims.com/jobs/search?ss=1&in_iframe=1[&searchKeyword=...]
//   job links: /jobs/{id}/{title-slug}/job
// Config: provider: icims, slug: <subdomain after "careers-">, query: "AI" (optional)
import { getText, job } from './_http.mjs';

export default async function fetchIcims(entry) {
  const slug = entry.slug;
  const kw = entry.query ? `&searchKeyword=${encodeURIComponent(entry.query)}` : '';
  const seen = new Set();
  const out = [];
  // iCIMS paginates ~per page; pull the first few pages (newest roles).
  for (let pr = 0; pr < 4; pr++) {
    let html;
    try {
      html = await getText(`https://careers-${slug}.icims.com/jobs/search?ss=1&in_iframe=1&pr=${pr}${kw}`);
    } catch (e) {
      if (out.length) break;
      throw e;
    }
    const re = /\/jobs\/(\d+)\/([A-Za-z0-9-]+)\/job/g;
    let m;
    let pageNew = 0;
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      const s = m[2];
      if (seen.has(id)) continue;
      seen.add(id);
      pageNew++;
      out.push(
        job({
          title: s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          url: `https://careers-${slug}.icims.com/jobs/${id}/${s}/job`,
          location: '',
          company: entry.name,
          id,
        })
      );
    }
    if (pageNew === 0) break; // no more pages
  }
  return out;
}
