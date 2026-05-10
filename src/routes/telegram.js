import express from 'express';
import { db } from '../../db.js';
import { sendMessage } from '../lib/telegram.js';

const router = express.Router();

function maskToken(token) {
  if (!token) return null;
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '••••••' + token.slice(-4);
}

// The browser sends an anonymous device_id (random UUID stored in localStorage).
// We trust it as a soft key — anyone with the id can read/update its own config.
function getDeviceId(req, res) {
  const id = req.body?.device_id || req.query?.device_id || req.headers['x-device-id'];
  if (!id || typeof id !== 'string' || id.length < 8 || id.length > 64) {
    res.status(400).json({ error: 'Missing or invalid device_id' });
    return null;
  }
  return id;
}

router.get('/config', (req, res) => {
  const id = getDeviceId(req, res);
  if (!id) return;
  const cfg = db.prepare('SELECT * FROM telegram_configs WHERE device_id = ?').get(id);
  if (!cfg) return res.json({ config: null });
  let filters = [];
  try {
    filters = cfg.scanner_filters ? JSON.parse(cfg.scanner_filters) : [];
  } catch (e) {
    filters = [];
  }
  res.json({
    config: {
      bot_token_masked: maskToken(cfg.bot_token),
      has_token: !!cfg.bot_token,
      chat_id: cfg.chat_id,
      enabled: !!cfg.enabled,
      scanner_filters: filters,
    },
  });
});

router.post('/config', (req, res) => {
  const id = getDeviceId(req, res);
  if (!id) return;
  const { bot_token, chat_id, enabled, scanner_filters } = req.body || {};
  if (bot_token != null && typeof bot_token !== 'string')
    return res.status(400).json({ error: 'Invalid bot_token' });
  if (chat_id != null && typeof chat_id !== 'string' && typeof chat_id !== 'number')
    return res.status(400).json({ error: 'Invalid chat_id' });
  const filtersStr = JSON.stringify(Array.isArray(scanner_filters) ? scanner_filters : []);
  const enabledInt = enabled === false ? 0 : 1;
  const existing = db.prepare('SELECT * FROM telegram_configs WHERE device_id = ?').get(id);
  const finalToken = bot_token || (existing ? existing.bot_token : null);
  const finalChat =
    chat_id != null && chat_id !== '' ? String(chat_id) : existing ? existing.chat_id : null;
  db.prepare(
    `INSERT INTO telegram_configs (device_id, bot_token, chat_id, enabled, scanner_filters, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET
       bot_token = excluded.bot_token,
       chat_id = excluded.chat_id,
       enabled = excluded.enabled,
       scanner_filters = excluded.scanner_filters,
       updated_at = excluded.updated_at`,
  ).run(id, finalToken, finalChat, enabledInt, filtersStr, Date.now());
  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  const id = getDeviceId(req, res);
  if (!id) return;
  const cfg = db.prepare('SELECT * FROM telegram_configs WHERE device_id = ?').get(id);
  if (!cfg || !cfg.bot_token || !cfg.chat_id) {
    return res.status(400).json({ error: 'Configure bot_token and chat_id first' });
  }
  const result = await sendMessage(
    cfg.bot_token,
    cfg.chat_id,
    '✅ <b>CA RAJ Scanner Terminal</b>\nTest message — your Telegram is wired correctly.',
  );
  if (!result.ok) return res.status(502).json({ error: 'Telegram rejected the message', detail: result });
  res.json({ ok: true });
});

export default router;
