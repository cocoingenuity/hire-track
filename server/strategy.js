const DEFAULTS = {
  visa_status: 'PGWP',
  languages: ['English'],
  has_vehicle: false,
  security_clearance: false,
  target_roles: '',
  experience_level: 'Entry-level',
  blacklisted_keywords: '',
};

function getStrategy(db) {
  const row = db.prepare('SELECT * FROM user_strategy WHERE id = 1').get();
  if (!row) return DEFAULTS;
  return {
    visa_status:          row.visa_status          || DEFAULTS.visa_status,
    languages:            JSON.parse(row.languages  || '[]'),
    has_vehicle:          row.has_vehicle           === 1,
    security_clearance:   row.security_clearance    === 1,
    target_roles:         row.target_roles          || '',
    experience_level:     row.experience_level      || DEFAULTS.experience_level,
    blacklisted_keywords: row.blacklisted_keywords  || '',
  };
}

module.exports = { getStrategy };
