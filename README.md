# job-watcher

Free, cloud-hosted job-drop alerter. Every hour, GitHub Actions hits company
career feeds (Greenhouse / Ashby / Lever / Workday + Amazon, Apple, Microsoft,
Google), filters to your target titles, and **emails + Telegrams you the moment
a new matching role is posted** — once each, never repeated.

- **Free** — runs on GitHub Actions. Public repo = unlimited minutes; private =
  2,000 free min/month (an hourly run uses far less).
- **No server, no LLM** — pure Node, deterministic. Your laptop can be off.
- **Scales by one line** — add a company in [`companies.yml`](companies.yml).

## How it works

1. `src/index.mjs` loads `companies.yml`, fetches each company via its provider.
2. Titles are filtered (positive/negative keywords in `companies.yml`).
3. New roles = matched roles whose id/url isn't in `state/seen.json`.
4. New roles → email + Telegram; then their ids are written to `seen.json`,
   which the workflow commits back so you're never alerted twice.
5. **First run seeds a baseline silently** (no giant first email).

## One-time setup

### 1. Push to GitHub
```bash
gh repo create job-watcher --private --source . --push
```

### 2. Add secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `GMAIL_USER` | your Gmail address |
| `GMAIL_APP_PASSWORD` | a Gmail **App Password** (see below) |
| `ALERT_TO` | where alerts go (e.g. `arun@armoriq.io`) |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_CHAT_ID` | your chat id (see below) |

**Gmail App Password:** Google Account → Security → 2-Step Verification (must be
on) → App passwords → generate one for "Mail". Use that 16-char value (not your
normal password).

**Telegram bot:** message [@BotFather](https://t.me/BotFather) → `/newbot` → copy
the token. Then message your new bot once, open
`https://api.telegram.org/bot<TOKEN>/getUpdates`, and copy the `chat.id`.

### 3. Seed the baseline, then go live
- Actions tab → **job-watcher** → **Run workflow** → mode `seed` (records current
  roles without spamming you).
- After that, the hourly cron alerts only on net-new roles. Done.

## Run / test locally

```bash
npm install
node src/index.mjs --dry-run                 # fetch + filter + list new; sends nothing
node src/index.mjs --dry-run --company Sierra # one company
node src/index.mjs --seed                     # set baseline locally
GMAIL_USER=... GMAIL_APP_PASSWORD=... ALERT_TO=... \
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
node src/index.mjs --test-alert               # verify delivery
```

## Adding companies

Edit [`companies.yml`](companies.yml) → add under `companies:`:

```yaml
- { name: Acme, provider: greenhouse, slug: acme }       # boards-api.greenhouse.io/v1/boards/acme/jobs
- { name: Beta, provider: ashby, slug: beta }            # api.ashbyhq.com/posting-api/job-board/beta
- { name: Gamma, provider: lever, slug: gamma }          # api.lever.co/v0/postings/gamma
```

Providers: `greenhouse`, `ashby`, `lever`, `workday`, `amazon`, `apple`,
`microsoft`, `google`, `eightfold`, `meta`. Set `enabled: false` to mute.

### Provider status

| Provider | Status |
|----------|--------|
| greenhouse, ashby, lever | ✅ stable public JSON |
| smartrecruiters, workable, recruitee, bamboohr | ✅ public JSON (Visa, Bosch, Mercari, bunq…) |
| workday (Salesforce, Nvidia, Intel, Adobe, Micron, Broadcom, Citi, Morgan Stanley, PayPal, Mastercard, BlackRock, Deutsche Bank, Capital One, PNC, Truist, Fidelity) | ✅ public CXS API |
| oracle (American Express) | ✅ Oracle Recruiting Cloud REST |
| careershome (AMD) | ✅ Radancy/iCIMS careers-home `/api/jobs` |
| goldman (Goldman Sachs) | ✅ higher.gs.com GraphQL gateway |
| amazon | ✅ public `search.json` |
| eightfold (Microsoft, Qualcomm) | ✅ Eightfold `pcsx` JSON API |
| playwright (Apple, Google, Meta, Uber, Netflix, Wells Fargo) | ✅ headless browser (best-effort; bot-blocked / JS-only sites) |

> Big-tech reality (verified 2026-06-23, incl. a live browser session): Amazon,
> Microsoft, Salesforce, Nvidia work cleanly over plain HTTP. Apple loads results
> client-side via a CSRF-shaped POST, Google is a heavyweight internal RPC SPA,
> and Meta needs a rotating GraphQL token — covering those reliably requires
> Playwright in CI, deferred until it's worth the dependency.

Every provider fails soft: if one endpoint breaks, the run logs it and continues.
