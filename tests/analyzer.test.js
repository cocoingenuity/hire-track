jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            match_score: 85,
            match_tier: 'Strong Match',
            strengths: ['IT support experience', 'PGWP authorization'],
            gaps: ['No CCNA certification'],
            key_requirements: ['Tier 1/2 support', 'Windows AD'],
            apply_recommendation: true,
            one_line_pitch: 'My hands-on IT support background makes me a strong fit.'
          })
        }
      })
    })
  }))
}));

const { analyze } = require('../server/analyzer');

describe('Analyzer', () => {
  it('returns structured analysis object', async () => {
    const result = await analyze('resume text here', 'job description here');
    expect(result).toHaveProperty('match_score');
    expect(result).toHaveProperty('match_tier');
    expect(result).toHaveProperty('strengths');
    expect(result).toHaveProperty('gaps');
    expect(result).toHaveProperty('key_requirements');
    expect(result).toHaveProperty('apply_recommendation');
    expect(result).toHaveProperty('one_line_pitch');
  });

  it('match_score is a number between 0 and 100', async () => {
    const result = await analyze('resume', 'job');
    expect(typeof result.match_score).toBe('number');
    expect(result.match_score).toBeGreaterThanOrEqual(0);
    expect(result.match_score).toBeLessThanOrEqual(100);
  });

  it('match_tier is a valid tier string', async () => {
    const result = await analyze('resume', 'job');
    expect(['Strong Match', 'Good Match', 'Stretch', 'Skip']).toContain(result.match_tier);
  });

  it('strengths, gaps, and key_requirements are arrays', async () => {
    const result = await analyze('resume', 'job');
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.gaps)).toBe(true);
    expect(Array.isArray(result.key_requirements)).toBe(true);
  });
});
