const tracks = require('../config/tracks');

describe('tracks config', () => {
  test('is a non-empty array', () => {
    expect(Array.isArray(tracks)).toBe(true);
    expect(tracks.length).toBeGreaterThan(0);
  });

  test('each track has required fields', () => {
    for (const track of tracks) {
      expect(typeof track.id).toBe('string');
      expect(typeof track.label).toBe('string');
      expect(typeof track.emoji).toBe('string');
      expect(typeof track.resume).toBe('string');
      expect(Array.isArray(track.queries)).toBe(true);
      expect(track.queries.length).toBeGreaterThan(0);
    }
  });

  test('track ids are unique', () => {
    const ids = tracks.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
