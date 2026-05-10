import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { migrate } from './db.js';
import { seedIfEmpty } from './src/lib/seed.js';
import { readSession } from './src/lib/auth.js';

import scannersRouter from './src/routes/scanners.js';
import streamRouter from './src/routes/stream.js';
import webhookRouter from './src/routes/webhook.js';
import telegramRouter from './src/routes/telegram.js';
import adminRouter from './src/routes/admin.js';
import authRouter from './src/routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

migrate();
seedIfEmpty();

const app = express();
app.set('trust proxy', 1); // behind Render's proxy
app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

// Webhook is JSON-parsed inside the route (different shape) and is NOT auth-gated
app.use('/api/webhook', webhookRouter);

app.use(express.json({ limit: '256kb' }));

// Auth routes (no gate)
app.use('/auth', authRouter);

// Approved-user-gated APIs
app.use('/api/scanners', scannersRouter);
app.use('/api/stream', streamRouter);
app.use('/api/telegram', telegramRouter);

// Admin API (X-Admin-Token gated, separate from user auth)
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) =>
  res.json({ ok: true, ts: Date.now(), mode: 'public-google-auth' }),
);

// HTML page routing — gate the index page on session
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendFile(res, name) {
  res.sendFile(path.join(PUBLIC_DIR, name));
}

app.get('/login', (req, res) => sendFile(res, 'login.html'));
app.get('/pending', (req, res) => sendFile(res, 'pending.html'));
app.get('/admin', (req, res) => sendFile(res, 'admin.html'));

app.get('/', (req, res) => {
  const user = readSession(req);
  if (!user) return res.redirect('/login');
  if (user.status !== 'approved') return res.redirect('/pending');
  return sendFile(res, 'index.html');
});

app.get('/scanner.html', (req, res) => {
  const user = readSession(req);
  if (!user) return res.redirect('/login');
  if (user.status !== 'approved') return res.redirect('/pending');
  return sendFile(res, 'scanner.html');
});

// Serve static assets (CSS/JS/images) — index.html still served via the gated route above.
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    index: false, // disable auto-index so our gated '/' handler runs
  }),
);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] CA RAJ Scanner Terminal listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] NODE_ENV=${process.env.NODE_ENV || 'development'} | mode=google-auth+approval`);
});
