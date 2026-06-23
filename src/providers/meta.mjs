// Meta (metacareers.com) uses a GraphQL backend that requires a rotating
// fb_dtsg token + session, so there's no clean unauthenticated JSON endpoint.
// Phase-2 placeholder: returns [] so the run stays green. Replace the body once
// a stable retrieval method is verified (e.g. a maintained scraper endpoint).
export default async function fetchMeta() {
  // TODO(phase-2): implement Meta careers retrieval.
  return [];
}
