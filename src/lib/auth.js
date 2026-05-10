import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../../db.js';

const COOKIE_NAME = 'caraj_session';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function jwtSecret() {
  const s = process.env.JWT_SECRET || process.env.SECRET_SALT;
  if (!s) throw new Error('JWT_SECRET (or SECRET_SALT) must be set');
  return s;
}

export function signSession(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, status: user.status },
    jwtSecret(),
    { expiresIn: '30d' },
  );
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function readSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret());
    // Always re-fetch live status from DB so revocation is instant
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    return user || null;
  } catch (e) {
    return null;
  }
}

export function requireApprovedUser(req, res, next) {
  const user = readSession(req);
  if (!user) return res.status(401).json({ error: 'not_signed_in' });
  if (user.status !== 'approved') return res.status(403).json({ error: 'not_approved', status: user.status });
  req.user = user;
  next();
}

export function requireSignedInUser(req, res, next) {
  const user = readSession(req);
  if (!user) return res.status(401).json({ error: 'not_signed_in' });
  req.user = user;
  next();
}

// State token used in OAuth flow (CSRF-protect by signing returnTo and a nonce)
export function signOauthState(returnTo) {
  return jwt.sign({ rt: returnTo || '/', n: crypto.randomBytes(8).toString('hex') }, jwtSecret(), {
    expiresIn: '10m',
  });
}

export function verifyOauthState(state) {
  try {
    return jwt.verify(state, jwtSecret());
  } catch {
    return null;
  }
}
