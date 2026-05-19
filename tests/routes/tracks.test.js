const request = require('supertest');
const app = require('../../server/app');

describe('GET /api/tracks', () => {
  it('returns 200 with array of tracks', async () => {
    const res = await request(app).get('/api/tracks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each track has id, label, emoji, queries', async () => {
    const res = await request(app).get('/api/tracks');
    for (const track of res.body) {
      expect(track).toHaveProperty('id');
      expect(track).toHaveProperty('label');
      expect(track).toHaveProperty('emoji');
      expect(track).toHaveProperty('queries');
      expect(Array.isArray(track.queries)).toBe(true);
    }
  });

  it('does not expose resume file paths', async () => {
    const res = await request(app).get('/api/tracks');
    for (const track of res.body) {
      expect(track.resume).toBeUndefined();
    }
  });
});
