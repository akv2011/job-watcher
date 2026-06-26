// Sakana AI (Tokyo) — custom server-rendered careers page, no standard ATS.
//   https://sakana.ai/careers/  → links to /careers/{role-slug}
// Config: provider: sakana  (no slug needed)
import { getText, job } from './_http.mjs';

const NON_JOBS = new Set(['', 'software', 'engineering', 'research', 'craft-fish']);

export default async function fetchSakana(entry) {
  const html = await getText('https://sakana.ai/careers/');
  const seen = new Set();
  const out = [];
  const re = /\/careers\/([a-z0-9][a-z0-9-]{6,})/g; // real role slugs are long/hyphenated
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1];
    if (seen.has(slug) || NON_JOBS.has(slug)) continue;
    seen.add(slug);
    out.push(
      job({
        title: humanize(slug),
        url: `https://sakana.ai/careers/${slug}`,
        location: 'Tokyo, Japan',
        company: entry.name,
        id: slug,
      })
    );
  }
  return out;
}

function humanize(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
