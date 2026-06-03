const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

const DEFAULTS = {
  visa_status: 'PGWP',
  languages: ['English'],
  has_vehicle: false,
  security_clearance: false,
  target_roles: '',
  experience_level: ['Entry-level'],
  blacklisted_keywords: '',
  employment_type: 'any',
  work_model: [],
};

function parseJsonArray(raw, fallback) {
  if (Array.isArray(raw)) return raw;
  try { const p = JSON.parse(raw || 'null'); return Array.isArray(p) ? p : fallback; } catch { return fallback; }
}

function rowToJson(row) {
  if (!row) return DEFAULTS;
  return {
    track_id:             row.track_id,
    visa_status:          row.visa_status,
    languages:            parseJsonArray(row.languages, ['English']),
    has_vehicle:          row.has_vehicle === 1,
    security_clearance:   row.security_clearance === 1,
    target_roles:         row.target_roles,
    experience_level:     parseJsonArray(row.experience_level, ['Entry-level']),
    blacklisted_keywords: row.blacklisted_keywords,
    employment_type:      row.employment_type || 'any',
    work_model:           parseJsonArray(row.work_model, []),
  };
}

router.get('/', (req, res) => {
  const { track_id } = req.query;
  if (!track_id) return res.status(400).json({ error: 'track_id query param required' });
  const db = getDb();
  const row = db.prepare('SELECT * FROM user_strategy WHERE track_id = ?').get(track_id);
  res.json(rowToJson(row));
});

router.post('/', (req, res) => {
  const { track_id, visa_status, languages, has_vehicle, security_clearance,
          target_roles, experience_level, blacklisted_keywords,
          employment_type, work_model } = req.body;

  if (!track_id) return res.status(400).json({ error: 'track_id required' });

  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO user_strategy
      (track_id, visa_status, languages, has_vehicle, security_clearance,
       target_roles, experience_level, blacklisted_keywords,
       employment_type, work_model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    track_id,
    visa_status,
    JSON.stringify(Array.isArray(languages) ? languages : []),
    has_vehicle ? 1 : 0,
    security_clearance ? 1 : 0,
    target_roles,
    JSON.stringify(Array.isArray(experience_level) ? experience_level : [experience_level || 'Entry-level']),
    blacklisted_keywords,
    employment_type || 'any',
    JSON.stringify(Array.isArray(work_model) ? work_model : []),
  );

  const saved = db.prepare('SELECT * FROM user_strategy WHERE track_id = ?').get(track_id);
  res.json(rowToJson(saved));
});

module.exports = router;
