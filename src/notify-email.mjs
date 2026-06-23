// Email delivery via Gmail SMTP (nodemailer + app password).
// Env: GMAIL_USER, GMAIL_APP_PASSWORD, ALERT_TO
// If creds are absent, this is a no-op (logs a warning) so local dry runs work.
import nodemailer from 'nodemailer';

export function emailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.ALERT_TO);
}

export async function sendEmail({ subject, html, text }) {
  if (!emailConfigured()) {
    console.warn('  email: skipped (GMAIL_USER / GMAIL_APP_PASSWORD / ALERT_TO not set)');
    return false;
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: `Job Watcher <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_TO,
    subject,
    text,
    html,
  });
  return true;
}

// Build an email body from grouped new jobs.
export function renderEmail(byCompany) {
  const companies = Object.keys(byCompany).sort();
  const total = companies.reduce((n, c) => n + byCompany[c].length, 0);
  const subject = `🔔 ${total} new role${total === 1 ? '' : 's'} — ${companies.slice(0, 4).join(', ')}${companies.length > 4 ? '…' : ''}`;

  const htmlParts = [`<h2>${total} new role${total === 1 ? '' : 's'}</h2>`];
  const textParts = [`${total} new roles`, ''];
  for (const c of companies) {
    htmlParts.push(`<h3>${esc(c)}</h3><ul>`);
    textParts.push(`== ${c} ==`);
    for (const j of byCompany[c]) {
      const loc = j.location ? ` — ${esc(j.location)}` : '';
      htmlParts.push(`<li><a href="${esc(j.url)}">${esc(j.title)}</a>${loc}</li>`);
      textParts.push(`- ${j.title}${j.location ? ` — ${j.location}` : ''}\n  ${j.url}`);
    }
    htmlParts.push('</ul>');
    textParts.push('');
  }
  return { subject, html: htmlParts.join('\n'), text: textParts.join('\n') };
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
