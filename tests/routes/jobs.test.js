const request = require('supertest');
const app = require('../../server/app');
const { getDb } = require('../../server/db');

function seedJobs() {
  const db = getDb();
  db.prepare('DELETE FROM jobs').run();
  db.prepare(`
    INSERT INTO jobs (track, title, company, apply_url, match_score, match_tier, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('it-support', 'IT Support Specialist', 'Telesat', 'https://ex.com/1', 92, 'Strong Match', 'Saved');
  db.prepare(`
    INSERT INTO jobs (track, title, company, apply_url, match_score, match_tier, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin', 'Admin Assistant', 'GoC', 'https://ex.com/2', 74, 'Good Match', 'Applied');
  db.prepare(`
    INSERT INTO jobs (track, title, company, apply_url, match_score, match_tier, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('it-support', 'Helpdesk Analyst', 'Shopify', 'https://ex.com/3', 58, 'Stretch', 'Saved');
}

describe('GET /api/jobs', () => {
  beforeEach(seedJobs);

  it('returns all jobs sorted by score descending', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0].match_score).toBeGreaterThanOrEqual(res.body[1].match_score);
    expect(res.body[1].match_score).toBeGreaterThanOrEqual(res.body[2].match_score);
  });

  it('filters by track', async () => {
    const res = await request(app).get('/api/jobs?track=it-support');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every(j => j.track === 'it-support')).toBe(true);
  });

  it('filters by tier', async () => {
    const res = await request(app).get('/api/jobs?tier=Strong+Match');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].match_tier).toBe('Strong Match');
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/jobs?status=Applied');
    expect(res.status).toBe(200);
    expect(res.body.every(j => j.status === 'Applied')).toBe(true);
  });
});

describe('PATCH /api/jobs/:id/status', () => {
  beforeEach(seedJobs);

  it('updates status and returns updated job', async () => {
    const { body: jobs } = await request(app).get('/api/jobs');
    const id = jobs[0].id;

    const res = await request(app)
      .patch(`/api/jobs/${id}/status`)
      .send({ status: 'Applied' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Applied');
    expect(res.body.id).toBe(id);
  });

  it('rejects invalid status with 400', async () => {
    const { body: jobs } = await request(app).get('/api/jobs');
    const res = await request(app)
      .patch(`/api/jobs/${jobs[0].id}/status`)
      .send({ status: 'Ghosted' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for nonexistent job', async () => {
    const res = await request(app)
      .patch('/api/jobs/99999/status')
      .send({ status: 'Applied' });
    expect(res.status).toBe(404);
  });
});
