const { detectHardBlockers, applyHardBlockers, BLOCKER_MSG } = require('../server/analyzer/blockers');
const { shouldFilter } = require('../server/scraper/linkedin');

describe('detectHardBlockers — fires on true disqualifiers', () => {
  const cases = [
    ['must be a Canadian citizen', 'pr'],
    ['Permanent Residents only', 'pr'],
    ['PR required for this role', 'pr'],
    ['must be eligible to work in Canada without sponsorship', 'pr'],
    ['This is a Co-op position', 'student'],
    ['Summer Internship 2026', 'student'],
    ['Applicants must be currently enrolled in a degree program', 'student'],
    ['Valid security clearance is required', 'clearance'],
    ['Enhanced reliability status needed', 'clearance'],
  ];
  it.each(cases)('blocks %j', (text, key) => {
    const blockers = detectHardBlockers(text, { security_clearance: false });
    expect(blockers).toContain(BLOCKER_MSG[key]);
  });
});

describe('detectHardBlockers — does NOT fire on good-match signals', () => {
  const allowed = [
    'New grad welcome to apply',
    'Recent graduate encouraged to apply',
    'Junior Software Developer',
    'Entry-level role, great for new graduates',
    'Permanent residency is an asset',
    'PR preferred but not required',
    'Canadian citizenship considered an asset',
  ];
  it.each(allowed)('allows %j', (text) => {
    expect(detectHardBlockers(text, { security_clearance: false })).toEqual([]);
  });

  it('does not raise the clearance blocker when the candidate holds clearance', () => {
    expect(detectHardBlockers('security clearance required', { security_clearance: true })).toEqual([]);
  });
});

describe('applyHardBlockers — caps a parsed result when blockers fired', () => {
  const parsed = { match_score: 82, match_tier: 'Strong Match', apply_recommendation: true, gaps: ['Minor gap'] };

  it('floors score to <=35, sets Skip, false recommendation, prepends blocker', () => {
    const out = applyHardBlockers(parsed, [BLOCKER_MSG.pr]);
    expect(out.match_score).toBeLessThanOrEqual(35);
    expect(out.match_tier).toBe('Skip');
    expect(out.apply_recommendation).toBe(false);
    expect(out.gaps[0]).toBe(BLOCKER_MSG.pr);
    expect(out.gaps).toContain('Minor gap');
  });

  it('returns the result unchanged when no blockers fired', () => {
    expect(applyHardBlockers(parsed, [])).toBe(parsed);
  });
});

describe('shouldFilter — software-developer track allowlist', () => {
  const t = 'software-developer';
  it('drops hardware/IC/FPGA/embedded roles', () => {
    expect(shouldFilter('FPGA Developer', '', t)).toBe(true);
    expect(shouldFilter('Analog/Mixed-Signal IC Design Developer', '', t)).toBe(true);
    expect(shouldFilter('Senior Embedded Software Developer', '', t)).toBe(true);
    expect(shouldFilter('Firmware Engineer', '', t)).toBe(true);
  });

  it('drops senior-level titles (candidate is junior/entry-level)', () => {
    expect(shouldFilter('Senior Software Engineer', '', t)).toBe(true);
    expect(shouldFilter('Sr. Software Developer', '', t)).toBe(true);
    expect(shouldFilter('Lead Developer', '', t)).toBe(true);
    expect(shouldFilter('Principal Software Engineer', '', t)).toBe(true);
    expect(shouldFilter('Staff Software Engineer', '', t)).toBe(true);
    expect(shouldFilter('Software Development Manager', '', t)).toBe(true);
    expect(shouldFilter('Director of Engineering', '', t)).toBe(true);
    expect(shouldFilter('Software Architect', '', t)).toBe(true);
    expect(shouldFilter('Senior Software Developer in Test', '', t)).toBe(true);
  });

  it('keeps junior/entry/unmodified software roles', () => {
    expect(shouldFilter('Software Engineer', '', t)).toBe(false);
    expect(shouldFilter('Junior Developer', '', t)).toBe(false);
    expect(shouldFilter('Junior Software Developer', '', t)).toBe(false);
    expect(shouldFilter('Intermediate Software Developer', '', t)).toBe(false);
    expect(shouldFilter('Full Stack Developer', '', t)).toBe(false);
    expect(shouldFilter('Associate Software Developer', '', t)).toBe(false);
    expect(shouldFilter('Software Engineer – Frontend', '', t)).toBe(false);
  });

  it('drops non-software titles', () => {
    expect(shouldFilter('Marketing Manager', '', t)).toBe(true);
  });
});
