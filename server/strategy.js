const DEFAULTS = {
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

function getStrategy(db, trackId) {
  const row = db.prepare('SELECT * FROM user_strategy WHERE track_id = ?').get(trackId);
  if (!row) return DEFAULTS;
  return {
    target_roles:         row.target_roles         || '',
    experience_level:     parseJsonArray(row.experience_level, ['Entry-level']),
    blacklisted_keywords: row.blacklisted_keywords  || '',
    employment_type:      row.employment_type       || 'any',
    work_model:           parseJsonArray(row.work_model, []),
  };
}

module.exports = { getStrategy };
