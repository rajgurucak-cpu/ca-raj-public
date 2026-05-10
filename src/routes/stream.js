import express from 'express';
import { addClient } from '../lib/sse.js';

const router = express.Router();

router.get('/', (req, res) => {
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
