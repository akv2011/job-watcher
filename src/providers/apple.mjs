// Apple careers — no public JSON API, but jobs.apple.com server-renders the
// results into HTML, so a plain GET + parse works (no browser needed).
// Each role appears as <a href="/en-us/details/{id}/{slug}">.
// Config: provider: apple, query: "machine learning" (optional, -> ?search=)
import { getText, job } from './_http.mjs';

export default async function fetchApple(entry) {
  const query = entry.query || '';
  const url =
    'https://jobs.apple.com/en-us/search?' +
    new URLSearchParams({ sort: 'newest', ...(query ? { search: query } : {}) }).toString();
  const html = await getText(url);

  // Collect unique detail links: /en-us/details/<id>/<slug>
  const re = /\/en-us\/details\/([0-9-]+)\/([a-z0-9-]+)/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, id, slug] = m;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(
      job({
        title: humanize(slug),
        url: `https://jobs.apple.com/en-us/details/${id}/${slug}`,
        location: '', // location lives in separate DOM nodes; left blank (filter is title-based)
        company: entry.name,
        id,
      })
    );
  }
  return out;
}

// "rendering-engine-software-engineer" -> "Rendering Engine Software Engineer"
function humanize(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
