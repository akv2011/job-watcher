// Headless-browser provider for sites with no clean public API (they bot-block
// plain HTTP or render jobs only via JS). Each site has a URL + an in-page
// extract function. `playwright` is imported lazily so the rest of the watcher
// runs even when it isn't installed (that company just fails-soft).
//
// Config: provider: playwright, site: <key from SITES below>
import { job } from './_http.mjs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Each site: { url, waitSelector?, wait?, extract } — extract runs in the page
// and returns [{ id, title, url, location }].
const SITES = {
  apple: {
    url: 'https://jobs.apple.com/en-us/search?sort=newest&team=apps-and-frameworks-SFTWR-AF&team=machine-learning-and-ai-SFTWR-MCHLN&team=cloud-and-infrastructure-SFTWR-CLD&team=software-quality-automation-and-tools-SFTWR-SQAT',
    waitSelector: 'a[href*="/details/"]',
    extract: () => {
      const seen = new Set(), out = [];
      document.querySelectorAll('a[href*="/details/"]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/details\/([0-9-]+)\/([a-z0-9-]+)/);
        if (!m) return;
        const id = m[1], t = (a.textContent || '').trim();
        if (seen.has(id) || !t || /see full role/i.test(t)) return;
        seen.add(id);
        out.push({ id, title: t, url: 'https://jobs.apple.com' + href.split('?')[0], location: '' });
      });
      return out;
    },
  },
  google: {
    url: 'https://www.google.com/about/careers/applications/jobs/results/?sort_by=date&q=software%20engineer',
    waitSelector: 'a[href*="jobs/results/"]',
    extract: () => {
      const seen = new Set(), out = [];
      document.querySelectorAll('a[href*="jobs/results/"]').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(/jobs\/results\/(\d+)-([a-z0-9-]+)/);
        if (!m) return;
        const id = m[1], slug = m[2];
        if (seen.has(id)) return;
        seen.add(id);
        const h = a.closest('li,div') && a.closest('li,div').querySelector('h3');
        out.push({
          id,
          title: h ? h.textContent.trim() : slug.replace(/-/g, ' '),
          url: 'https://www.google.com/about/careers/applications/jobs/results/' + id + '-' + slug,
          location: '',
        });
      });
      return out;
    },
  },
  meta: {
    url: 'https://www.metacareers.com/jobs?q=software%20engineer',
    waitSelector: 'a[href*="/profile/job_details/"]',
    extract: () => {
      const seen = new Set(), out = [];
      document.querySelectorAll('a[href*="/profile/job_details/"]').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(/job_details\/(\d+)/);
        if (!m) return;
        const id = m[1];
        if (seen.has(id)) return;
        seen.add(id);
        // The card text is "Title{Location}⋅{Dept}⋅…"; the clean title is the
        // shortest descendant fragment (no ⋅) that the full text starts with.
        const full = (a.textContent || '').trim();
        let title = '';
        a.querySelectorAll('div,span').forEach((d) => {
          const t = (d.textContent || '').trim();
          if (t && !t.includes('⋅') && full.startsWith(t) && (!title || t.length < title.length)) title = t;
        });
        if (!title) title = full.split('⋅')[0].trim();
        out.push({ id, title, url: 'https://www.metacareers.com/jobs/' + id + '/', location: '' });
      });
      return out;
    },
  },
  uber: {
    url: 'https://www.uber.com/us/en/careers/list/?query=engineer',
    waitSelector: 'a[href*="/careers/list/"]',
    extract: () => {
      const seen = new Set(), out = [];
      document.querySelectorAll('a[href*="/careers/list/"]').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(/\/careers\/list\/(\d+)/);
        if (!m) return;
        const id = m[1], t = (a.textContent || '').trim();
        if (seen.has(id) || !t) return;
        seen.add(id);
        out.push({ id, title: t, url: 'https://www.uber.com/us/en/careers/list/' + id + '/', location: '' });
      });
      return out;
    },
  },
  wellsfargo: {
    url: 'https://www.wellsfargojobs.com/en/jobs/?search=software+engineer&sortBy=relevancy',
    waitSelector: 'a[href*="/en/jobs/r-"]',
    extract: () => {
      const seen = new Set(), out = [];
      document.querySelectorAll('a[href*="/en/jobs/r-"]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/en\/jobs\/(r-\d+)\/([a-z0-9-]+)/);
        if (!m) return;
        const id = m[1], slug = m[2];
        if (seen.has(id)) return;
        seen.add(id);
        const t = (a.textContent || '').trim() || slug.replace(/-/g, ' ');
        out.push({ id, title: t, url: 'https://www.wellsfargojobs.com' + href.split('?')[0], location: '' });
      });
      return out;
    },
  },
  cisco: {
    url: 'https://careers.cisco.com/global/en/search-results?keywords=software%20engineer',
    waitSelector: 'a[href*="/global/en/job/"]',
    extract: () => {
      const seen = new Set(), out = [];
      document.querySelectorAll('a[href*="/global/en/job/"]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/global\/en\/job\/(\d+)\/([A-Za-z0-9-]+)/);
        if (!m) return;
        const id = m[1];
        if (seen.has(id)) return;
        seen.add(id);
        const t = (a.textContent || '').trim() || m[2].replace(/-/g, ' ');
        out.push({ id, title: t, url: href.startsWith('http') ? href : 'https://careers.cisco.com' + href, location: '' });
      });
      return out;
    },
  },
  netflix: {
    // Eightfold: bot-blocks plain HTTP, but the in-page fetch (after the page
    // establishes a session) returns clean JSON.
    url: 'https://explore.jobs.netflix.net/careers?query=engineer&sort_by=new',
    wait: 3500,
    extract: async () => {
      const r = await fetch(
        '/api/apply/v2/jobs?domain=netflix.com&query=engineer&sort_by=new&start=0&num=50',
        { headers: { accept: 'application/json' } }
      );
      const j = await r.json();
      const p = j.positions || (j.data && j.data.positions) || [];
      return p.map((x) => ({
        id: String(x.id),
        title: x.name,
        url: x.canonicalPositionUrl || 'https://explore.jobs.netflix.net/careers/job/' + x.id,
        location: Array.isArray(x.locations) ? x.locations.join('; ') : x.location || '',
      }));
    },
  },
};

let _browserPromise = null;
async function getBrowser() {
  if (!_browserPromise) {
    const { chromium } = await import('playwright');
    _browserPromise = chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  }
  return _browserPromise;
}

// Called once by the runner after all scanning is done, so the process exits.
export async function closeBrowser() {
  if (_browserPromise) {
    const b = await _browserPromise;
    await b.close();
    _browserPromise = null;
  }
}

export default async function fetchPlaywright(entry) {
  const site = SITES[entry.site];
  if (!site) throw new Error(`unknown playwright site: ${entry.site}`);
  const browser = await getBrowser();
  const page = await browser.newPage({ userAgent: UA });
  try {
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (site.waitSelector) {
      await page.waitForSelector(site.waitSelector, { timeout: 20000 }).catch(() => {});
    }
    await page.waitForTimeout(site.wait || 2500);
    const rows = await page.evaluate(site.extract);
    return (rows || [])
      .filter((r) => r && r.title && r.url)
      .map((r) => job({ title: r.title, url: r.url, location: r.location, company: entry.name, id: r.id }));
  } finally {
    await page.close();
  }
}
