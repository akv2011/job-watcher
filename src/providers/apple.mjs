// Apple jobs public search API.
//   POST https://jobs.apple.com/api/role/search
// Config: provider: apple, query: "Machine Learning" (optional)
// Apple's endpoint can be picky about headers; provider fails soft.
import { postJSON, job } from './_http.mjs';

export default async function fetchApple(entry) {
  const query = entry.query || 'Machine Learning';
  const data = await postJSON(
    'https://jobs.apple.com/api/role/search',
    {
      query,
      filters: {},
      page: 1,
      locale: 'en-us',
      sort: 'newest',
    },
    { headers: { 'x-requested-with': 'XMLHttpRequest' } }
  );
  const list = Array.isArray(data?.searchResults) ? data.searchResults : [];
  return list.map((j) => {
    const locs = j.locations?.map((l) => l.name).filter(Boolean).join('; ');
    return job({
      title: j.postingTitle || j.title,
      url: j.positionId
        ? `https://jobs.apple.com/en-us/details/${j.positionId}`
        : '',
      location: locs,
      company: entry.name,
      id: j.positionId || j.id,
    });
  });
}
