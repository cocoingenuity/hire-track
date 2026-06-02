const { scrape } = require('../server/scraper');

describe('Scraper (DRY_RUN=true)', () => {
  it('returns array of jobs for it-support', async () => {
    const jobs = await scrape('it-support');
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('returns array of jobs for admin', async () => {
    const jobs = await scrape('admin');
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('each job has required fields', async () => {
    const jobs = await scrape('it-support');
    for (const job of jobs) {
      expect(typeof job.title).toBe('string');
      expect(typeof job.company).toBe('string');
      expect(typeof job.apply_url).toBe('string');
      expect(typeof job.description).toBe('string');
    }
  });

  it('throws for unknown track', async () => {
    await expect(scrape('developer')).rejects.toThrow('Unknown track');
  });
});
