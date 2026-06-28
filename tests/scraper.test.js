const { scrape } = require('../server/scraper');

// scrape(trackId, onJob) no longer returns an array — it emits each job through
// the onJob callback (callback pattern since v2.0, commit d25a561). Collect them.
async function collectJobs(trackId) {
  const jobs = [];
  await scrape(trackId, job => { jobs.push(job); });
  return jobs;
}

describe('Scraper (DRY_RUN=true)', () => {
  it('emits jobs for it-support via the onJob callback', async () => {
    const jobs = await collectJobs('it-support');
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('emits jobs for admin', async () => {
    const jobs = await collectJobs('admin');
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('each emitted job has the required fields', async () => {
    const jobs = await collectJobs('it-support');
    for (const job of jobs) {
      expect(typeof job.title).toBe('string');
      expect(typeof job.company).toBe('string');
      expect(typeof job.apply_url).toBe('string');
      expect(typeof job.description).toBe('string');
    }
  });

  it('throws for an unknown track', async () => {
    await expect(scrape('developer', () => {})).rejects.toThrow('Unknown track');
  });
});
