const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { getProfile } = require('../profile');

router.get('/', (req, res) => {
  const db = getDb();
  res.json(getProfile(db));
});

router.post('/', (req, res) => {
  const { visa_status, languages, has_vehicle, security_clearance } = req.body;
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO global_profile (id, visa_status, languages, has_vehicle, security_clearance)
    VALUES (1, ?, ?, ?, ?)
  `).run(
    visa_status,
    JSON.stringify(Array.isArray(languages) ? languages : []),
    has_vehicle ? 1 : 0,
    security_clearance ? 1 : 0,
  );
  res.json(getProfile(db));
});

module.exports = router;
