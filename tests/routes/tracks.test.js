const request = require('supertest');
const app = require('../../server/app');

// GET /api/tracks returns DB-backed tracks (job_tracks: id, name, emoji,
// resume_file_path) since the v3.1 migration — not the old config shape that
// had `label` and `queries`.
describe('GET /api/tracks', () => {
  it('returns 200 with array of tracks', async () => {
    const res = await request(app).get('/api/tracks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each track has the DB-track shape (id, name, emoji)', async () => {
    const res = await request(app).get('/api/tracks');
    for (const track of res.body) {
      expect(track).toHaveProperty('id');
      expect(track).toHaveProperty('name');
      expect(track).toHaveProperty('emoji');
      expect(typeof track.id).toBe('string');
      expect(typeof track.name).toBe('string');
    }
  });

  it('does not expose the old config-only fields (label, queries)', async () => {
    const res = await request(app).get('/api/tracks');
    for (const track of res.body) {
      expect(track.label).toBeUndefined();
      expect(track.queries).toBeUndefined();
    }
  });
});
