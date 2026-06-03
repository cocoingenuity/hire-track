const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

const DEFAULTS = {
  visa_status: 'PGWP',
  languages: ['English'],
  has_vehicle: false,
  security_clearance: false,
  target_roles: '',
  experience_level: 'Entry-level',
  blacklisted_keywords: '',
};

function rowToJson(row) {
  if (!row) return DEFAULTS;
  return {
    visa_status:          row.visa_status,
    languages:            JSON.parse(row.languages || '[]'),
    has_vehicle:          row.has_vehicle === 1,
    security_clearance:   row.security_clearance === 1,
    target_roles:         row.target_roles,
    experience_level:     row.experience_level,
    blacklisted_keywords: row.blacklisted_keywords,
  };
}

router.get('/', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM user_strategy WHERE id = 1').get();
  res.json(rowToJson(row));
});

router.post('/', (req, res) => {
  const { visa_status, languages, has_vehicle, security_clearance,
          target_roles, experience_level, blacklisted_keywords } = req.body;

  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO user_strategy
      (id, visa_status, languages, has_vehicle, security_clearance,
       target_roles, experience_level, blacklisted_keywords)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    visa_status,
    JSON.stringify(Array.isArray(languages) ? languages : []),
    has_vehicle ? 1 : 0,
    security_clearance ? 1 : 0,
    target_roles,
    experience_level,
    blacklisted_keywords,
  );

  const saved = db.prepare('SELECT * FROM user_strategy WHERE id = 1').get();
  res.json(rowToJson(saved));
});

module.exports = router;
