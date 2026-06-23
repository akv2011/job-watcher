// Oracle Recruiting Cloud (Fusion ORC) — used by American Express and many
// large enterprises. Public JSON, no auth.
//   https://{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=findReqs;siteNumber={site},...
// Config per company:
//   provider: oracle
//   host: egug.fa.us2.oraclecloud.com   # the *.oraclecloud.com Fusion host
//   site: CX_1                          # siteNumber
//   jobUrlBase: https://careers.example.com/en/sites/CX_1/job   # optional vanity link base
import { getJSON, job } from './_http.mjs';

export default async function fetchOracle(entry) {
  const { host, site } = entry;
  if (!host || !site) throw new Error('oracle entry needs host and site');
  // The `finder` value uses literal ; and , — build the URL manually so they
  // aren't percent-encoded (URLSearchParams would break the finder syntax).
  const url =
    `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?onlyData=true&expand=requisitionList.secondaryLocations` +
    `&finder=findReqs;siteNumber=${site},limit=50,sortBy=POSTING_DATES_DESC`;
  const data = await getJSON(url);
  const list = data?.items?.[0]?.requisitionList || [];
  const base = entry.jobUrlBase || `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job`;
  return list.map((r) =>
    job({
      title: r.Title,
      url: `${base}/${r.Id}`,
      location: r.PrimaryLocation,
      company: entry.name,
      id: r.Id,
    })
  );
}
