const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isTest = process.env.NODE_ENV === 'test';
const DB_PATH = isTest
  ? ':memory:'
  : path.join(__dirname, '../data/hiretrack.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  if (!isTest) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      track             TEXT NOT NULL,
      title             TEXT NOT NULL,
      company           TEXT NOT NULL,
      location          TEXT,
      date_posted       TEXT,
      description       TEXT,
      apply_url         TEXT UNIQUE,
      source            TEXT DEFAULT 'indeed',
      match_score       INTEGER,
      match_tier        TEXT,
      strengths         TEXT,
      gaps              TEXT,
      key_requirements  TEXT,
      apply_recommendation INTEGER,
      one_line_pitch    TEXT,
      noc_code          TEXT,
      noc_explanation   TEXT,
      teer_level        INTEGER,
      analyzed_at       TEXT,
      status            TEXT DEFAULT NULL,
      scraped_at        TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_strategy (
      id                   INTEGER PRIMARY KEY DEFAULT 1,
      visa_status          TEXT    DEFAULT 'PGWP',
      languages            TEXT    DEFAULT '["English"]',
      has_vehicle          INTEGER DEFAULT 0,
      security_clearance   INTEGER DEFAULT 0,
      target_roles         TEXT    DEFAULT '',
      experience_level     TEXT    DEFAULT 'Entry-level',
      blacklisted_keywords TEXT    DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS scrape_runs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      track          TEXT NOT NULL,
      status         TEXT,
      jobs_found     INTEGER DEFAULT 0,
      jobs_new       INTEGER DEFAULT 0,
      jobs_analyzed  INTEGER DEFAULT 0,
      error_msg      TEXT,
      started_at     TEXT DEFAULT CURRENT_TIMESTAMP,
      finished_at    TEXT
    );
  `);

  // Versioned migrations via SQLite user_version pragma
  const ver = _db.pragma('user_version', { simple: true });
  if (ver < 1) {
    if (!isTest) {
      _db.prepare("DELETE FROM jobs WHERE source = 'fixture'").run();
    }
    _db.prepare("UPDATE jobs SET status = NULL WHERE status = 'Saved'").run();
    _db.pragma('user_version = 1');
  }
  if (ver < 2) {
    // Add NOC classification columns (ALTER TABLE is safe on existing DBs; fresh DBs get them from CREATE TABLE)
    try { _db.prepare('ALTER TABLE jobs ADD COLUMN noc_code TEXT').run(); } catch {}
    try { _db.prepare('ALTER TABLE jobs ADD COLUMN noc_explanation TEXT').run(); } catch {}
    _db.pragma('user_version = 2');
  }
  if (ver < 3) {
    try { _db.prepare('ALTER TABLE jobs ADD COLUMN teer_level INTEGER').run(); } catch {}
    _db.pragma('user_version = 3');
  }

  // Every startup: abandon any scrape runs that were left in 'running' state by a
  // previous server process (crash, restart, Ctrl-C). Without this, POST /scrape/:track
  // returns the stale run ID and the frontend polls forever.
  _db.prepare(
    "UPDATE scrape_runs SET status = 'error', error_msg = 'Server restarted — run abandoned', finished_at = datetime('now') WHERE status = 'running'"
  ).run();

  return _db;
}

module.exports = { getDb };
