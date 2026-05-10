import express from 'express';
import { addClient } from '../lib/sse.js';
import { readSession } from '../lib/auth.js';

const router = express.Router();

router.get('/', (req, res) => {
  const user = readSession(req);
  if (!user || user.status !== 'approved') {
    return res.status(401).json({ error: 'not_approved' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`event: hello\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  const remove = addClient(res);
  const ping = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch (e) {
      // ignore
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(ping);
    remove();
    try {
      res.end();
    } catch (e) {
      // ignore
    }
  });
});

export default router;
