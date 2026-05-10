import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { migrate } from './db.js';
import { seedIfEmpty } from './src/lib/seed.js';

import scannersRouter from './src/routes/scanners.js';
import streamRouter from './src/routes/stream.js';
import webhookRouter from './src/routes/webhook.js';
import telegramRouter from './src/routes/telegram.js';
import adminRouter from './src/routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

migrate();
seedIfEmpty();

const app = express();
app.disable('x-powered-by');
app.use(cors());

app.use('/api/webhook', webhookRouter);

app.use(express.json({ limit: '256kb' }));

app.use('/api/scanners', scannersRouter);
app.use('/api/stream', streamRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) =>
  res.json({ ok: true, ts: Date.now(), mode: 'public-no-auth' }),
);

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] CA RAJ Scanner Terminal (public) listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] NODE_ENV=${process.env.NODE_ENV || 'development'} | mode=public-no-auth`);
});
