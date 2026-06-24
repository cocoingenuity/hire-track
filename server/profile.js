const DEFAULTS = {
  visa_status: 'PGWP',
  languages: ['English'],
  has_vehicle: false,
  security_clearance: false,
  candidate_note: 'Graduate (Computer Programming diploma, Apr 2025), on PGWP — eligible for full-time and new-grad roles, NOT a student (cannot take co-op/internship roles requiring enrollment).',
};

function parseJsonArray(raw, fallback) {
  if (Array.isArray(raw)) return raw;
  try { const p = JSON.parse(raw || 'null'); return Array.isArray(p) ? p : fallback; } catch { return fallback; }
}

function getProfile(db) {
  const row = db.prepare('SELECT * FROM global_profile WHERE id = 1').get();
  if (!row) return DEFAULTS;
  return {
    visa_status:        row.visa_status        || DEFAULTS.visa_status,
    languages:          parseJsonArray(row.languages, ['English']),
    has_vehicle:        row.has_vehicle        === 1,
    security_clearance: row.security_clearance === 1,
    candidate_note:     row.candidate_note     || DEFAULTS.candidate_note,
  };
}

module.exports = { getProfile };
