// Goldman Sachs careers (higher.gs.com) — custom platform on a public GraphQL
// gateway. No auth needed.
//   POST https://api-higher.gs.com/gateway/api/v1/graphql  (GetRoles query)
// Config: provider: goldman, query: "engineer" (optional searchTerm)
import { postJSON, job } from './_http.mjs';

const QUERY =
  'query GetRoles($searchQueryInput: RoleSearchQueryInput!) {\n' +
  '  roleSearch(searchQueryInput: $searchQueryInput) {\n' +
  '    totalCount\n' +
  '    items { roleId jobTitle jobFunction locations { primary state country city __typename } division __typename }\n' +
  '    __typename\n  }\n}';

export default async function fetchGoldman(entry) {
  const body = {
    operationName: 'GetRoles',
    variables: {
      searchQueryInput: {
        page: { pageSize: 50, pageNumber: 0 },
        sort: { sortStrategy: 'RELEVANCE', sortOrder: 'DESC' },
        filters: [],
        experiences: ['EARLY_CAREER', 'PROFESSIONAL'],
        searchTerm: entry.query || 'engineer',
      },
    },
    query: QUERY,
  };
  const data = await postJSON('https://api-higher.gs.com/gateway/api/v1/graphql', body);
  const items = data?.data?.roleSearch?.items || [];
  return items.map((it) =>
    job({
      title: it.jobTitle,
      url: `https://higher.gs.com/roles/${it.roleId}`,
      location: (it.locations || []).map((l) => l.city || l.primary).filter(Boolean).join('; '),
      company: entry.name,
      id: it.roleId,
    })
  );
}
