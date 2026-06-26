// D. E. Shaw (deshaw.com/careers) — custom server-rendered listing, no ATS.
//   /careers/{title-slug}-{reqId}  links on the main careers page.
// Config: provider: deshaw  (no slug)
import { getText, job } from './_http.mjs';

export default async function fetchDeshaw(entry) {
  const html = await getText('https://www.deshaw.com/careers');
  const seen = new Set();
  const out = [];
  const re = /\/careers\/([a-z0-9-]+-(\d{3,}))/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = '/careers/' + m[1];
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    const title = humanize(m[1].replace(/-\d{3,}$/, ''));
    out.push({ title, url: 'https://www.deshaw.com' + path, location: '', company: entry.name, id });
  }
  return out.map((r) => job(r));
}

function humanize(s) {
  return s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
