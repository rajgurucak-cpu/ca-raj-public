import express from 'express';
import { db } from '../../db.js';
import {
  signSession,
  setSessionCookie,
  clearSessionCookie,
  readSession,
  signOauthState,
  verifyOauthState,
} from '../lib/auth.js';

const router = express.Router();

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';

function publicBase(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function redirectUri(req) {
  return `${publicBase(req)}/auth/google/callback`;
}

// Kick off Google OAuth
router.get('/google/login', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).send('Google sign-in not configured (GOOGLE_CLIENT_ID missing)');
  const state = signOauthState(req.query.returnTo || '/');
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  res.redirect(url.toString());
});

// Google redirects here after consent
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.status(400).send('Google sign-in error: ' + error);
    if (!code || !state) return res.status(400).send('Missing code or state');
    const stateData = verifyOauthState(state);
    if (!stateData) return res.status(400).send('Invalid or expired state');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(503).send('Google sign-in not configured');

    // Exchange code for token
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      console.error('[auth] token exchange failed', tokenRes.status, t);
      return res.status(502).send('Token exchange failed');
    }
    const tokens = await tokenRes.json();

    // Fetch user profile
    const uRes = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!uRes.ok) return res.status(502).send('Userinfo fetch failed');
    const profile = await uRes.json();

    const sub = profile.sub;
    const email = (profile.email || '').toLowerCase();
    const name = profile.name || email;
    const picture = profile.picture || '';
    if (!sub || !email) return res.status(400).send('Google did not return required fields');

    // Upsert user
    let user = db.prepare('SELECT * FROM users WHERE google_sub = ? OR email = ?').get(sub, email);
    const ownerEmail = (process.env.OWNER_EMAIL || '').toLowerCase();
    const now = Date.now();
    if (!user) {
      const initialStatus = email === ownerEmail ? 'approved' : 'pending';
      const approvedAt = initialStatus === 'approved' ? now : null;
      const id = 'u_' + sub;
      db.prepare(
        `INSERT INTO users (id, google_sub, email, name, picture, status, created_at, approved_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, sub, email, name, picture, initialStatus, now, approvedAt, now);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else {
      // Backfill / refresh fields. Auto-promote owner email if it lands here.
      const newStatus = user.email === ownerEmail && user.status !== 'approved' ? 'approved' : user.status;
      const newApprovedAt = newStatus === 'approved' && !user.approved_at ? now : user.approved_at;
      db.prepare(
        `UPDATE users SET google_sub = ?, name = ?, picture = ?, status = ?, approved_at = ?, last_login_at = ? WHERE id = ?`,
      ).run(sub, name, picture, newStatus, newApprovedAt, now, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    const token = signSession(user);
    setSessionCookie(res, token);

    if (user.status === 'approved') {
      const dest = stateData.rt && stateData.rt.startsWith('/') ? stateData.rt : '/';
      return res.redirect(dest);
    }
    return res.redirect('/pending');
  } catch (e) {
    console.error('[auth] callback error', e);
    res.status(500).send('Sign-in failed');
  }
});

router.get('/me', (req, res) => {
  const user = readSession(req);
  if (!user) return res.json({ user: null });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      status: user.status,
    },
  });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
router.get('/logout', (req, res) => {
  clearSessionCookie(res);
  res.redirect('/login');
});

export default router;
