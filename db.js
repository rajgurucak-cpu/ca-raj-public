import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'scanner.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scanners (
      id TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      tier TEXT,
      cat TEXT,
      bias TEXT,
      descr TEXT,
      live INTEGER DEFAULT 0,
      webhook_secret TEXT,
      created_at INTEGER,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS scan_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scanner_id TEXT,
      symbol TEXT,
      trigger_price REAL,
      triggered_at INTEGER,
      raw_payload TEXT,
      created_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_scanner_time ON scan_alerts(scanner_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS telegram_configs (
      device_id TEXT PRIMARY KEY,
      bot_token TEXT,
      chat_id TEXT,
      enabled INTEGER DEFAULT 1,
      scanner_filters TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE,
      email TEXT UNIQUE,
      name TEXT,
      picture TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      approved_at INTEGER,
      last_login_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  `);

  // Auto-approve owner email (only takes effect if user already signed in)
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail) {
    db.prepare(
      "UPDATE users SET status = 'approved', approved_at = COALESCE(approved_at, ?) WHERE email = ? AND status != 'approved'",
    ).run(Date.now(), ownerEmail.toLowerCase());
  }
}
