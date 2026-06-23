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
import amazon from './providers/amazon.mjs';
import apple from './providers/apple.mjs';
import microsoft from './providers/microsoft.mjs';
import google from './providers/google.mjs';
import eightfold from './providers/eightfold.mjs';
import meta from './providers/meta.mjs';

const PROVIDERS = {
  greenhouse, ashby, lever, workday,
  amazon, apple, microsoft, google, eightfold, meta,
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
  const rows = await pool(companies, CONCURRENCY, async (entry) => {
    const provider = PROVIDERS[entry.provider];
    if (!provider) {
      errors.push({ name: entry.name, error: `unknown provider "${entry.provider}"` });
      return [];
    }
    try {
      const jobs = await provider(entry);
      return jobs.filter((j) => j.url && j.title);
    } catch (err) {
      errors.push({ name: entry.name, error: err.message });
      return [];
    }
  });
  return { jobs: rows.flat(), errors };
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

async function main() {
  if (TEST_ALERT) {
    await sendTestAlert();
    return;
  }

  const cfg = loadConfig();
  console.log(`Scanning ${cfg.companies.length} companies…`);
  const { jobs, errors } = await fetchAll(cfg.companies);

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

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
