import express from 'express';
import { db } from '../../db.js';
import { publishAlert } from '../lib/sse.js';
import { sendMessage, formatAlert } from '../lib/telegram.js';

const router = express.Router();

// CHARTINK WEBHOOK — public site, but each scanner has its own per-scanner secret
// embedded in the URL, so only Chartink (configured via the admin panel) can post alerts.
router.post('/chartink/:scannerId', express.json({ limit: '256kb' }), async (req, res) => {
  const { scannerId } = req.params;
  const secret = req.query.secret;
  const scanner = db.prepare('SELECT * FROM scanners WHERE id = ?').get(scannerId);
  if (!scanner) return res.status(404).json({ error: 'Scanner not found' });
  if (!secret || secret !== scanner.webhook_secret) {
    return res.status(401).json({ error: 'Bad secret' });
  }
  const body = req.body || {};
  const stocks = String(body.stocks || '').split(',').map((s) => s.trim()).filter(Boolean);
  const prices = String(body.trigger_prices || '').split(',').map((s) => parseFloat(s.trim()));
  const triggeredAtRaw = body.triggered_at || '';
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO scan_alerts (scanner_id, symbol, trigger_price, triggered_at, raw_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const raw = JSON.stringify(body);
  const inserted = [];
  const tx = db.transaction(() => {
    stocks.forEach((symbol, i) => {
      const price = Number.isFinite(prices[i]) ? prices[i] : null;
      const info = insert.run(scanner.id, symbol, price, parseTriggeredAt(triggeredAtRaw), raw, now);
      inserted.push({
        id: info.lastInsertRowid,
        symbol,
        trigger_price: price,
        triggered_at: now,
        scanner_id: scanner.id,
      });
    });
  });
  tx();

  // Broadcast each alert via SSE to all connected browsers.
  for (const a of inserted) publishAlert(scanner, a);

  // Forward to any Telegram configs (anonymous device-keyed in this public version).
  forwardToTelegram(scanner, inserted).catch((e) =>
    console.error('[telegram] forward error', e.message),
  );

  res.json({ ok: true, count: inserted.length });
});

function parseTriggeredAt(s) {
  if (!s) return Date.now();
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return Date.now();
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && hh < 12) hh += 12;
  if (ap === 'am' && hh === 12) hh = 0;
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 - now.getTimezoneOffset()) * 60_000);
  ist.setUTCHours(hh, mm, 0, 0);
  return ist.getTime() - (5.5 * 60 - now.getTimezoneOffset()) * 60_000;
}

async function forwardToTelegram(scanner, alerts) {
  const configs = db
    .prepare(
      `SELECT * FROM telegram_configs WHERE enabled = 1 AND bot_token IS NOT NULL AND chat_id IS NOT NULL`,
    )
    .all();
  if (!configs.length) return;
  for (const cfg of configs) {
    let filters = [];
    try {
      filters = cfg.scanner_filters ? JSON.parse(cfg.scanner_filters) : [];
    } catch (e) {
      filters = [];
    }
    if (Array.isArray(filters) && filters.length && !filters.includes(scanner.id)) continue;
    for (const alert of alerts) {
      sendMessage(cfg.bot_token, cfg.chat_id, formatAlert(scanner, alert)).catch(() => {});
    }
  }
}

export default router;
