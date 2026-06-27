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

describe('shouldFilter — it-support track allowlist (anchor + role-type)', () => {
  const t = 'it-support';

  it('keeps genuine IT roles that have both an anchor and a role word', () => {
    expect(shouldFilter('IT Support Specialist', '', t)).toBe(false);
    expect(shouldFilter('Helpdesk Analyst', '', t)).toBe(false);
    expect(shouldFilter('Technical Support', '', t)).toBe(false);
    expect(shouldFilter('Systems Administrator', '', t)).toBe(false);
    expect(shouldFilter('Desktop Support Technician', '', t)).toBe(false);
    expect(shouldFilter('IT Technician', '', t)).toBe(false);
    expect(shouldFilter('Network Support Technician', '', t)).toBe(false);
    expect(shouldFilter('Service Desk Analyst', '', t)).toBe(false);
    expect(shouldFilter('End User Support', '', t)).toBe(false);
    expect(shouldFilter('Computer Technician', '', t)).toBe(false);
    expect(shouldFilter('Cybersecurity Analyst', '', t)).toBe(false);
    expect(shouldFilter('IT Coordinator', '', t)).toBe(false);
    // Broadened anchors: user/eus/salesforce/application support/L1-2/tier 1-2
    expect(shouldFilter('Support Specialist II - User Enablement', '', t)).toBe(false);
    expect(shouldFilter('L2 Support Engineer', '', t)).toBe(false);
    expect(shouldFilter('Salesforce Administrator', '', t)).toBe(false);
    expect(shouldFilter('Application Support Specialist', '', t)).toBe(false);
    expect(shouldFilter('Tier 1 Support Analyst', '', t)).toBe(false);
    expect(shouldFilter('ServiceNow Administrator', '', t)).toBe(false);
    expect(shouldFilter('Specialist, Identity & Access Management', '', t)).toBe(false);
    expect(shouldFilter('Deskside Support / Field Services', '', t)).toBe(false);
    expect(shouldFilter('Specialist, Applications', '', t)).toBe(false);
  });

  it('drops generic non-IT titles that only match a bare role word', () => {
    expect(shouldFilter('Business Analyst', '', t)).toBe(true);
    expect(shouldFilter('Financial Planning & Analysis Coordinator', '', t)).toBe(true);
    expect(shouldFilter('Data Analyst', '', t)).toBe(true);
    expect(shouldFilter('Project Coordinator', '', t)).toBe(true);
    expect(shouldFilter('Customer Support Representative', '', t)).toBe(true);
  });

  it('vetoes explicit non-IT domain phrases', () => {
    expect(shouldFilter('Software Developer', '', t)).toBe(true);
    expect(shouldFilter('Siemens Electrical Apprentice', '', t)).toBe(true);
    expect(shouldFilter('Electrical Engineer', '', t)).toBe(true);
    expect(shouldFilter('Financial Analyst', '', t)).toBe(true);
  });

  it('drops senior/sr titles without an entry-friendly role type', () => {
    expect(shouldFilter('Senior System Administrator', '', t)).toBe(true);
    expect(shouldFilter('Sr. Specialist, Technical Training', '', t)).toBe(false); // specialist kept (normal domain)
    expect(shouldFilter('Senior Systems Administrator – CICS on Mainframe', '', t)).toBe(true);
    expect(shouldFilter('Sr. HPC & IT Systems Engineer', '', t)).toBe(true);
    expect(shouldFilter('Senior Cloud Technical Lead', '', t)).toBe(true);
  });

  it('keeps senior titles with an entry-friendly role type', () => {
    expect(shouldFilter('Senior Systems Analyst', '', t)).toBe(false);
    expect(shouldFilter('Senior Network Support Specialist', '', t)).toBe(false);
    expect(shouldFilter('Senior Technician Security', '', t)).toBe(false);
    expect(shouldFilter('Senior Analyst, Application Support', '', t)).toBe(false);
  });

  it('blocks senior+specialist in high-barrier sub-domains', () => {
    expect(shouldFilter('Senior Specialist, Identity & Access Management', '', t)).toBe(true);
    expect(shouldFilter('Sr Identity Management Specialist', '', t)).toBe(true);
    expect(shouldFilter('Senior Azure Cloud DevOps Specialist', '', t)).toBe(true);
    expect(shouldFilter('Senior Cybersecurity Specialist, Vulnerability Management', '', t)).toBe(true);
    // entry-friendly + specialist in a normal domain still allowed
    expect(shouldFilter('Sr. Specialist, Technical Training', '', t)).toBe(false);
    expect(shouldFilter('Senior Desktop Support Specialist', '', t)).toBe(false);
  });

  it('does not false-fire \\bsr\\b on SRE/CSR or non-senior titles', () => {
    expect(shouldFilter('Systems Engineer, SRE', '', t)).toBe(false);   // "sre" must not match \bsr\b
    expect(shouldFilter('Systems Administrator', '', t)).toBe(false);
  });
});
