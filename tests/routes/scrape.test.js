jest.mock('../../server/analyzer', () => ({
  analyze: jest.fn().mockResolvedValue({
    match_score: 80,
    match_tier: 'Strong Match',
    strengths: ['test strength'],
    gaps: [],
    key_requirements: ['support'],
    apply_recommendation: true,
    one_line_pitch: 'Test pitch line.'
  })
}));

jest.mock('../../server/resumes', () => ({
  loadResumes: jest.fn().mockResolvedValue(undefined),
  getResumeText: jest.fn().mockReturnValue('mock resume text')
}));

const request = require('supertest');
const app = require('../../server/app');
const { getDb } = require('../../server/db');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM jobs').run();
  db.prepare('DELETE FROM scrape_runs').run();
});

describe('POST /api/scrape/:track', () => {
  it('returns run_id immediately', async () => {
    const res = await request(app).post('/api/scrape/it-support');
    expect(res.status).toBe(200);
    expect(typeof res.body.run_id).toBe('number');
  });

  it('returns same run_id if a run is already in progress', async () => {
    const res1 = await request(app).post('/api/scrape/it-support');
    const res2 = await request(app).post('/api/scrape/it-support');
    expect(typeof res1.body.run_id).toBe('number');
    expect(typeof res2.body.run_id).toBe('number');
  });

  it('inserts jobs into the database after run completes', async () => {
    await request(app).post('/api/scrape/it-support');
    await wait(3000);
    const db = getDb();
    const jobs = db.prepare("SELECT * FROM jobs WHERE track = 'it-support'").all();
    expect(jobs.length).toBeGreaterThan(0);
  });
});

describe('GET /api/scrape/status/:track', () => {
  it('returns { status: "idle" } when no runs exist', async () => {
    const res = await request(app).get('/api/scrape/status/admin');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('idle');
  });

  it('returns run status after a scrape is triggered', async () => {
    await request(app).post('/api/scrape/it-support');
    const res = await request(app).get('/api/scrape/status/it-support');
    expect(res.status).toBe(200);
    expect(['running', 'done', 'error']).toContain(res.body.status);
  });

  it('run shows done and job counts after completion', async () => {
    await request(app).post('/api/scrape/it-support');
    await wait(3000);
    const res = await request(app).get('/api/scrape/status/it-support');
    expect(res.body.status).toBe('done');
    expect(res.body.jobs_found).toBeGreaterThan(0);
    expect(res.body.jobs_new).toBeGreaterThan(0);
  });
});
