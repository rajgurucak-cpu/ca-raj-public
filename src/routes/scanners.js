import express from 'express';
import { db } from '../../db.js';

const router = express.Router();

// Fully public — no auth, all scanners visible, all alerts visible.

router.get('/', (req, res) => {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const scanners = db
    .prepare(
      `SELECT s.id, s.name, s.url, s.tier, s.cat, s.bias, s.descr, s.live, s.sort_order,
              (SELECT COUNT(*) FROM scan_alerts a WHERE a.scanner_id = s.id AND a.created_at > ?) AS matchCount
       FROM scanners s ORDER BY s.sort_order ASC, s.id ASC`,
    )
    .all(since);
  res.json({
    scanners: scanners.map((s) => ({ ...s, live: !!s.live, locked: false })),
  });
});

router.get('/:id', (req, res) => {
  const s = db
    .prepare('SELECT id, name, url, tier, cat, bias, descr, live FROM scanners WHERE id = ?')
    .get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ scanner: { ...s, live: !!s.live, locked: false } });
});

router.get('/:id/alerts', (req, res) => {
  const scanner = db.prepare('SELECT id FROM scanners WHERE id = ?').get(req.params.id);
  if (!scanner) return res.status(404).json({ error: 'Not found' });
  const since = req.query.since ? Number(req.query.since) : 0;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const rows = db
    .prepare(
      `SELECT id, scanner_id, symbol, trigger_price, triggered_at, created_at
       FROM scan_alerts
       WHERE scanner_id = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(req.params.id, since, limit);
  res.json({ alerts: rows });
});

export default router;
