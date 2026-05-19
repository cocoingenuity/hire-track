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
      analyzed_at       TEXT,
      status            TEXT DEFAULT 'Saved',
      scraped_at        TEXT DEFAULT CURRENT_TIMESTAMP
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

  return _db;
}

module.exports = { getDb };
