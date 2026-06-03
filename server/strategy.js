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

function getStrategy(db) {
  const row = db.prepare('SELECT * FROM user_strategy WHERE id = 1').get();
  if (!row) return DEFAULTS;
  return {
    visa_status:          row.visa_status          || DEFAULTS.visa_status,
    languages:            parseJsonArray(row.languages, ['English']),
    has_vehicle:          row.has_vehicle           === 1,
    security_clearance:   row.security_clearance    === 1,
    target_roles:         row.target_roles          || '',
    experience_level:     parseJsonArray(row.experience_level, ['Entry-level']),
    blacklisted_keywords: row.blacklisted_keywords  || '',
    employment_type:      row.employment_type       || 'any',
    work_model:           parseJsonArray(row.work_model, []),
  };
}

module.exports = { getStrategy };
