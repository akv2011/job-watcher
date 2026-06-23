// Telegram push via Bot API sendMessage.
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// No-op (with warning) if creds are absent.

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegram(text) {
  if (!telegramConfigured()) {
    console.warn('  telegram: skipped (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set)');
    return false;
  }
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  // Telegram caps messages at 4096 chars — chunk if needed.
  for (const chunk of chunkText(text, 3900)) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Telegram HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  }
  return true;
}

export function renderTelegram(byCompany) {
  const companies = Object.keys(byCompany).sort();
  const total = companies.reduce((n, c) => n + byCompany[c].length, 0);
  const lines = [`🔔 <b>${total} new role${total === 1 ? '' : 's'}</b>`, ''];
  for (const c of companies) {
    lines.push(`<b>${esc(c)}</b>`);
    for (const j of byCompany[c]) {
      const loc = j.location ? ` — ${esc(j.location)}` : '';
      lines.push(`• <a href="${esc(j.url)}">${esc(j.title)}</a>${loc}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function chunkText(text, max) {
  if (text.length <= max) return [text];
  const out = [];
  const lines = text.split('\n');
  let buf = '';
  for (const line of lines) {
    if ((buf + '\n' + line).length > max) {
      if (buf) out.push(buf);
      buf = line;
    } else {
      buf = buf ? buf + '\n' + line : line;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
