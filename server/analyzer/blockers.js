// ---------------------------------------------------------------------------
// Deterministic hard-blocker detection (provider-agnostic).
//
// These binary disqualifiers used to be left to LLM judgement, which both
// over-fired (flooring jobs that only said "PR an asset / preferred") and
// under-fired. They are now matched against the JD text in code and applied as
// a cap AFTER the LLM has scored skill/experience fit, in the analyze() route,
// so the gate works regardless of which AI provider is active.
// ---------------------------------------------------------------------------

// PR / citizenship — only when the JD REQUIRES it (not "preferred / an asset").
const PR_REQUIRED_RE = new RegExp([
  'must be (a |an )?(canadian )?(citizen|permanent resident)',
  '(permanent resident|canadian citizen)s? (only|required)',
  'must (have|hold|possess) (canadian )?(citizenship|permanent residency)',
  'must be eligible to work in canada without (visa )?sponsorship',
  '\\b(pr|permanent residency|citizenship) (is )?required\\b',
].join('|'), 'i');

// Co-op / internship / current enrollment — a PGWP graduate cannot take these.
// MUST NOT match "new grad", "recent graduate", "junior", or "entry-level".
const STUDENT_ROLE_RE = new RegExp([
  '\\bco[-\\s]?op\\b',
  '\\binternships?\\b',
  '\\binterns?\\b',
  'currently enrolled',
  'pursuing a (degree|diploma)',
  'must be a (current )?student',
  'enrolled in (a |an )?(degree|diploma|university|college|post-secondary)',
].join('|'), 'i');

// Security clearance the candidate does not hold.
const CLEARANCE_REQUIRED_RE = new RegExp([
  'security clearance',
  'secret clearance',
  'top[\\s-]?secret',
  'reliability (status|clearance)',
  'enhanced reliability',
  'controlled goods program',
].join('|'), 'i');

const BLOCKER_MSG = {
  pr:        'Job explicitly requires Canadian PR or citizenship / 职位明确要求加拿大永久居民或公民身份',
  student:   'Co-op/internship requiring current enrollment — candidate is a PGWP graduate, not a student / 此为需在读学生的实习/co-op职位，候选人为PGWP毕业生而非在校学生',
  clearance: 'Job requires Canadian security clearance the candidate does not hold / 职位要求候选人不具备的加拿大安全许可',
};

// Returns an array of bilingual blocker strings that deterministically apply.
function detectHardBlockers(jobText, profile = {}) {
  const text = jobText || '';
  const blockers = [];
  if (PR_REQUIRED_RE.test(text)) blockers.push(BLOCKER_MSG.pr);
  if (STUDENT_ROLE_RE.test(text)) blockers.push(BLOCKER_MSG.student);
  if (!profile.security_clearance && CLEARANCE_REQUIRED_RE.test(text)) blockers.push(BLOCKER_MSG.clearance);
  return blockers;
}

// Caps a parsed LLM result when deterministic blockers fired. The LLM's skill
// score is preserved when nothing fires; otherwise the job is floored to Skip.
function applyHardBlockers(parsed, blockers) {
  if (!parsed || !blockers || blockers.length === 0) return parsed;
  return {
    ...parsed,
    match_score: Math.min(parsed.match_score ?? 0, 35),
    match_tier: 'Skip',
    apply_recommendation: false,
    gaps: [...blockers, ...(Array.isArray(parsed.gaps) ? parsed.gaps : [])],
  };
}

module.exports = {
  detectHardBlockers,
  applyHardBlockers,
  BLOCKER_MSG,
  PR_REQUIRED_RE,
  STUDENT_ROLE_RE,
  CLEARANCE_REQUIRED_RE,
};
