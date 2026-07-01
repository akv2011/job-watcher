#!/usr/bin/env node
/**
 * job-watcher — fetch company feeds, filter to target titles, diff against
 * seen.json, and alert (email + Telegram) on genuinely-new roles.
 *
 * Usage:
 *   node src/index.mjs               # scan, alert on new roles, persist seen.json
 *   node src/index.mjs --dry-run     # fetch + filter + report; write nothing, send nothing
 *   node src/index.mjs --seed        # record current roles as baseline; send no alert
 *   node src/index.mjs --test-alert  # send a sample email + Telegram to verify creds
 *   node src/index.mjs --company X   # restrict to one company (matches name, case-insensitive)
 *
 * Zero LLM tokens — pure HTTP + JSON. Designed to run on GitHub Actions hourly.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

import { keepJob } from './filter.mjs';
import { sendEmail, renderEmail, emailConfigured } from './notify-email.mjs';
import { sendTelegram, renderTelegram, telegramConfigured } from './notify-telegram.mjs';

import greenhouse from './providers/greenhouse.mjs';
import ashby from './providers/ashby.mjs';
import lever from './providers/lever.mjs';
import workday from './providers/workday.mjs';
import smartrecruiters from './providers/smartrecruiters.mjs';
import workable from './providers/workable.mjs';
import recruitee from './providers/recruitee.mjs';
import bamboohr from './providers/bamboohr.mjs';
import hrmos from './providers/hrmos.mjs';
import personio from './providers/personio.mjs';
import jazzhr from './providers/jazzhr.mjs';
import sakana from './providers/sakana.mjs';
import kula from './providers/kula.mjs';
import deshaw from './providers/deshaw.mjs';
import icims from './providers/icims.mjs';
import herp from './providers/herp.mjs';
import oracle from './providers/oracle.mjs';
import careershome from './providers/careershome.mjs';
import goldman from './providers/goldman.mjs';
import amazon from './providers/amazon.mjs';
import apple from './providers/apple.mjs';
import google from './providers/google.mjs';
import eightfold from './providers/eightfold.mjs';
import meta from './providers/meta.mjs';
import playwright, { closeBrowser } from './providers/playwright.mjs';

const PROVIDERS = {
  greenhouse, ashby, lever, workday, oracle, careershome, goldman,
  smartrecruiters, workable, recruitee, bamboohr, hrmos, herp, personio, jazzhr, sakana, kula, deshaw, icims,
  amazon, apple, google, eightfold, meta, playwright,
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'companies.yml');
const STATE_PATH = path.join(ROOT, 'state', 'seen.json');
const CONCURRENCY = 8;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SEED = args.includes('--seed');
const TEST_ALERT = args.includes('--test-alert');
const companyFilter = argValue('--company');

function argValue(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1].toLowerCase() : null;
}

function loadConfig() {
  const cfg = yaml.load(readFileSync(CONFIG_PATH, 'utf-8')) || {};
  cfg.companies = (cfg.companies || []).filter((c) => c.enabled !== false);
  if (companyFilter) {
    cfg.companies = cfg.companies.filter((c) => c.name.toLowerCase().includes(companyFilter));
  }
  return cfg;
}

function loadSeen() {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) || {};
  } catch {
    return {};
  }
}

function saveSeen(seen) {
  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(seen, null, 0) + '\n', 'utf-8');
}

// Run async tasks with a concurrency cap.
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchAll(companies) {
  const errors = [];
  const counts = []; // per non-errored company: { name, n } (raw fetched count)
  const rows = await pool(companies, CONCURRENCY, async (entry) => {
    const provider = PROVIDERS[entry.provider];
    if (!provider) {
      errors.push({ name: entry.name, error: `unknown provider "${entry.provider}"` });
      return [];
    }
    try {
      const jobs = (await provider(entry)).filter((j) => j.url && j.title);
      counts.push({ name: entry.name, n: jobs.length });
      return jobs;
    } catch (err) {
      errors.push({ name: entry.name, error: err.message });
      return [];
    }
  });
  return { jobs: rows.flat(), errors, counts };
}

async function sendTestAlert() {
  const sample = {
    'Example Co': [
      { title: 'Senior AI Engineer', location: 'Remote', url: 'https://example.com/jobs/1' },
    ],
  };
  console.log('Sending test alert…');
  const { subject, html, text } = renderEmail(sample);
  if (await sendEmail({ subject: `[TEST] ${subject}`, html, text })) console.log('  ✓ email sent');
  if (await sendTelegram('🧪 <b>job-watcher test</b>\nIf you see this, Telegram alerts work.')) {
    console.log('  ✓ telegram sent');
  }
}

// ── Provider health: email once when a company is persistently broken ──
const HEALTH_PATH = path.join(ROOT, 'state', 'health.json');
const FAIL_THRESHOLD = 3; // consecutive failed runs (~3 hours) before alerting
const ZERO_THRESHOLD = 24; // consecutive 0-job runs (~1 day) before flagging a company that USED to return jobs (catches silent breakage like a site migration)

function loadHealth() {
  try { return JSON.parse(readFileSync(HEALTH_PATH, 'utf-8')) || {}; } catch { return {}; }
}
function saveHealth(h) {
  mkdirSync(path.dirname(HEALTH_PATH), { recursive: true });
  writeFileSync(HEALTH_PATH, JSON.stringify(h, null, 0) + '\n', 'utf-8');
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Increment a per-company consecutive-failure counter; reset on success. When a
// company crosses FAIL_THRESHOLD it's reported once (not every run) so transient
// timeouts don't spam, but real breakage reaches you.
async function trackHealth(companies, errors, counts) {
  const health = loadHealth();
  const errMap = new Map(errors.map((e) => [e.name, e.error]));
  const countMap = new Map((counts || []).map((c) => [c.name, c.n]));
  const newlyBroken = []; // hard errors (FAIL_THRESHOLD in a row)
  const newlyStale = []; // returned 0 jobs for ZERO_THRESHOLD in a row (was returning jobs before)
  for (const c of companies) {
    const rec = health[c.name] || { fails: 0, notified: false, zeros: 0, zeroNotified: false, everReturned: false };
    if (errMap.has(c.name)) {
      rec.fails = (rec.fails || 0) + 1;
      rec.lastError = errMap.get(c.name);
      if (rec.fails >= FAIL_THRESHOLD && !rec.notified) {
        newlyBroken.push({ name: c.name, fails: rec.fails, error: rec.lastError });
        rec.notified = true;
      }
    } else {
      rec.fails = 0; rec.notified = false; delete rec.lastError;
      const n = countMap.get(c.name) ?? 0;
      if (n > 0) {
        rec.everReturned = true; rec.zeros = 0; rec.zeroNotified = false;
      } else if (rec.everReturned) {
        // 0 jobs now, but this company USED to return jobs → possible silent breakage
        rec.zeros = (rec.zeros || 0) + 1;
        if (rec.zeros >= ZERO_THRESHOLD && !rec.zeroNotified) {
          newlyStale.push({ name: c.name, zeros: rec.zeros });
          rec.zeroNotified = true;
        }
      }
    }
    health[c.name] = rec;
  }
  saveHealth(health);
  if (!newlyBroken.length && !newlyStale.length) return;

  const parts = [];
  if (newlyBroken.length) parts.push(`${newlyBroken.length} erroring`);
  if (newlyStale.length) parts.push(`${newlyStale.length} returning 0 jobs`);
  console.log(`\n🔧 job-watcher health: ${parts.join(', ')} — notifying.`);
  const subject = `🔧 job-watcher: ${parts.join(' + ')} — verify`;
  const brokenTxt = newlyBroken.length
    ? `Erroring ${FAIL_THRESHOLD}+ runs in a row (paused until fixed):\n` + newlyBroken.map((b) => `• ${b.name} (${b.fails} runs) — ${b.error}`).join('\n') + '\n\n'
    : '';
  const staleTxt = newlyStale.length
    ? `Returning 0 jobs for ${ZERO_THRESHOLD}+ runs (may be broken, or just no openings — verify):\n` + newlyStale.map((s) => `• ${s.name} (${s.zeros} runs at 0)`).join('\n') + '\n\n'
    : '';
  const text = brokenTxt + staleTxt + `A site feed/layout change usually causes this — the provider may need updating.`;
  const html =
    (newlyBroken.length ? `<h3>Erroring (${FAIL_THRESHOLD}+ runs)</h3><ul>` + newlyBroken.map((b) => `<li><b>${esc(b.name)}</b> — <code>${esc(b.error)}</code></li>`).join('') + '</ul>' : '') +
    (newlyStale.length ? `<h3>Returning 0 jobs (${ZERO_THRESHOLD}+ runs — verify)</h3><ul>` + newlyStale.map((s) => `<li><b>${esc(s.name)}</b> — ${s.zeros} runs at 0</li>`).join('') + '</ul>' : '') +
    `<p>A site feed/layout change usually causes this; the provider may need updating.</p>`;
  if (emailConfigured()) {
    try { if (await sendEmail({ subject, html, text })) console.log('  ✓ maintenance email sent'); }
    catch (e) { console.error(`  ✗ maintenance email failed: ${e.message}`); }
  }
  if (telegramConfigured()) {
    try { await sendTelegram('🔧 <b>job-watcher health</b>\n' + text); }
    catch (e) { console.error(`  ✗ maintenance telegram failed: ${e.message}`); }
  }
}

async function main() {
  if (TEST_ALERT) {
    await sendTestAlert();
    return;
  }

  const cfg = loadConfig();
  console.log(`Scanning ${cfg.companies.length} companies…`);
  const { jobs, errors, counts } = await fetchAll(cfg.companies);

  const matched = jobs.filter((j) => keepJob(j, cfg.filter || {}));
  console.log(`Fetched ${jobs.length} jobs, ${matched.length} match the title filter.`);

  const seen = loadSeen();
  const firstRun = Object.keys(seen).length === 0;

  // Determine which matched jobs are new (not in seen).
  const fresh = matched.filter((j) => !seen[j.id] && !seen[j.url]);

  // --- SEED or first-run baseline: record without alerting ---
  if (SEED || (firstRun && !DRY_RUN)) {
    for (const j of matched) seen[j.id] = { t: j.title, c: j.company };
    saveSeen(seen);
    console.log(
      firstRun
        ? `First run: seeded ${matched.length} current roles as baseline (no alert sent).`
        : `Seeded ${matched.length} roles as baseline (no alert sent).`
    );
    reportErrors(errors);
    return;
  }

  // Health check: alert on persistently-broken companies (runs even on quiet
  // hours so breakage reaches you). Skipped for dry-run / single-company runs.
  if (!DRY_RUN && !companyFilter) await trackHealth(cfg.companies, errors, counts);

  // Group new jobs by company for the alert body.
  const byCompany = {};
  for (const j of fresh) (byCompany[j.company] ||= []).push(j);

  if (fresh.length === 0) {
    console.log('No new roles since last run.');
    reportErrors(errors);
    return;
  }

  console.log(`\n${fresh.length} NEW role(s):`);
  for (const j of fresh) console.log(`  + ${j.company} | ${j.title} | ${j.location || 'N/A'}`);

  if (DRY_RUN) {
    console.log('\n(dry run — nothing sent, seen.json unchanged)');
    reportErrors(errors);
    return;
  }

  // --- Send alerts ---
  console.log('\nSending alerts…');
  if (emailConfigured()) {
    const { subject, html, text } = renderEmail(byCompany);
    try {
      if (await sendEmail({ subject, html, text })) console.log('  ✓ email sent');
    } catch (e) {
      console.error(`  ✗ email failed: ${e.message}`);
    }
  } else {
    console.warn('  email: not configured');
  }
  if (telegramConfigured()) {
    try {
      if (await sendTelegram(renderTelegram(byCompany))) console.log('  ✓ telegram sent');
    } catch (e) {
      console.error(`  ✗ telegram failed: ${e.message}`);
    }
  } else {
    console.warn('  telegram: not configured');
  }

  // --- Persist: only mark as seen AFTER a send attempt, so a delivery outage
  // doesn't silently swallow roles forever. ---
  for (const j of fresh) seen[j.id] = { t: j.title, c: j.company };
  saveSeen(seen);
  console.log(`Updated seen.json (+${fresh.length}).`);
  reportErrors(errors);
}

function reportErrors(errors) {
  if (errors.length) {
    console.log(`\n${errors.length} provider error(s) (non-fatal):`);
    for (const e of errors) console.log(`  ✗ ${e.name}: ${e.error}`);
  }
}

main()
  .catch((e) => {
    console.error('Fatal:', e);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser()); // release the headless browser so the process exits
