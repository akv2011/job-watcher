// Workday CXS API (Salesforce, Nvidia, and many enterprises).
// Config per company:
//   provider: workday
//   host: salesforce.wd12.myworkdayjobs.com
//   tenant: salesforce
//   site: External_Career_Site
//   searchText: "AI"            # optional server-side query
//
// Endpoint: POST https://{host}/wday/cxs/{tenant}/{site}/jobs
// Public job URL: https://{host}/{locale}/{site}{externalPath}
import { postJSON, job } from './_http.mjs';

export default async function fetchWorkday(entry) {
  const { host, tenant, site, searchText = '', locale = 'en-US' } = entry;
  if (!host || !tenant || !site) {
    throw new Error('workday entry needs host, tenant, site');
  }
  const out = [];
  // Pull the most recent page or two — cron runs hourly, so we only need the
  // newest postings, not the entire (often thousands-deep) board.
  for (let offset = 0; offset < 40; offset += 20) {
    let data;
    try {
      data = await postJSON(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, {
        appliedFacets: {},
        limit: 20,
        offset,
        searchText,
      });
    } catch (err) {
      // Flaky Workday boards (e.g. Truist) intermittently 500. If we already
      // have page-1 results, return them rather than failing the whole company.
      if (out.length > 0) break;
      throw err;
    }
    const postings = Array.isArray(data?.jobPostings) ? data.jobPostings : [];
    for (const p of postings) {
      out.push(
        job({
          title: p.title,
          url: `https://${host}/${locale}/${site}${p.externalPath}`,
          location: p.locationsText,
          company: entry.name,
          id: p.bulletFields?.[0] || p.externalPath,
        })
      );
    }
    if (postings.length < 20) break;
  }
  return out;
}
