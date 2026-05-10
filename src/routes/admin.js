import express from 'express';
import crypto from 'crypto';
import { db } from '../../db.js';
import { slugify } from '../lib/seed.js';

const router = express.Router();

function adminGate(req, res, next) {
  const token = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return res.status(503).json({ error: 'Admin not configured (ADMIN_TOKEN missing)' });
  if (token !== expected) return res.status(401).json({ error: 'Invalid admin token' });
  next();
}

router.use(adminGate);

function publicBase(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function withWebhookUrl(req, s) {
  return {
    ...s,
    live: !!s.live,
    webhook_url: `${publicBase(req)}/api/webhook/chartink/${s.id}?secret=${s.webhook_secret}`,
  };
}

router.get('/scanners', (req, res) => {
  const rows = db.prepare('SELECT * FROM scanners ORDER BY sort_order ASC, id ASC').all();
  res.json({ scanners: rows.map((s) => withWebhookUrl(req, s)) });
});

router.post('/scanners', (req, res) => {
  let { id, name, url, tier, cat, bias, descr, live, sort_order } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  if (!['free', 'pro'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });
  const liveInt = live ? 1 : 0;
  const finalCat = cat || 'setup';
  const finalBias = bias || 'bull';
  if (!id) id = uniqueId(slugify(name) || 'scanner');
  const existing = db.prepare('SELECT id, webhook_secret FROM scanners WHERE id = ?').get(id);
  if (existing) {
    db.prepare(
      `UPDATE scanners SET name = ?, url = ?, tier = ?, cat = ?, bias = ?, descr = ?, live = ?, sort_order = COALESCE(?, sort_order) WHERE id = ?`,
    ).run(name, url || '', tier, finalCat, finalBias, descr || '', liveInt, sort_order ?? null, id);
  } else {
    db.prepare(
      `INSERT INTO scanners (id, name, url, tier, cat, bias, descr, live, webhook_secret, created_at, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      name,
      url || '',
      tier,
      finalCat,
      finalBias,
      descr || '',
      liveInt,
      crypto.randomBytes(16).toString('hex'),
      Date.now(),
      sort_order ?? 999,
    );
  }
  const row = db.prepare('SELECT * FROM scanners WHERE id = ?').get(id);
  res.json({ scanner: withWebhookUrl(req, row) });
});

function uniqueId(base) {
  let candidate = base;
  let n = 2;
  while (db.prepare('SELECT 1 FROM scanners WHERE id = ?').get(candidate)) {
    candidate = base + '-' + n++;
  }
  return candidate;
}

router.delete('/scanners/:id', (req, res) => {
  const info = db.prepare('DELETE FROM scanners WHERE id = ?').run(req.params.id);
  res.json({ ok: true, deleted: info.changes });
});

router.post('/scanners/:id/rotate-secret', (req, res) => {
  const secret = crypto.randomBytes(16).toString('hex');
  const info = db.prepare('UPDATE scanners SET webhook_secret = ? WHERE id = ?').run(secret, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  const row = db.prepare('SELECT * FROM scanners WHERE id = ?').get(req.params.id);
  res.json({ scanner: withWebhookUrl(req, row) });
});

router.get('/stats', (req, res) => {
  const since24 = Date.now() - 24 * 60 * 60 * 1000;
  const scannerCount = db.prepare('SELECT COUNT(*) as c FROM scanners').get().c;
  const liveScannerCount = db.prepare('SELECT COUNT(*) as c FROM scanners WHERE live = 1').get().c;
  const telegramCount = db
    .prepare('SELECT COUNT(*) as c FROM telegram_configs WHERE enabled = 1 AND bot_token IS NOT NULL')
    .get().c;
  const alerts24 = db
    .prepare('SELECT COUNT(*) as c FROM scan_alerts WHERE created_at > ?')
    .get(since24).c;
  const topScanners = db
    .prepare(
      `SELECT s.id, s.name, COUNT(a.id) as alert_count
       FROM scanners s LEFT JOIN scan_alerts a ON a.scanner_id = s.id AND a.created_at > ?
       GROUP BY s.id ORDER BY alert_count DESC LIMIT 10`,
    )
    .all(since24);
  res.json({
    scanner_count: scannerCount,
    live_scanner_count: liveScannerCount,
    telegram_subscribers: telegramCount,
    alerts_last_24h: alerts24,
    top_scanners: topScanners,
  });
});

export default router;
