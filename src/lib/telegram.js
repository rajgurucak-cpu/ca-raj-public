export async function sendMessage(botToken, chatId, text) {
  if (!botToken || !chatId) return { ok: false, error: 'Missing bot_token or chat_id' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.ok, response: json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function formatAlert(scanner, alert) {
  const price = alert.trigger_price ? ` @ ₹${alert.trigger_price}` : '';
  return `🚨 <b>${escapeHtml(scanner.name)}</b>\n<b>${escapeHtml(alert.symbol)}</b>${price}\n<a href="https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(alert.symbol)}">Open chart →</a>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
}
