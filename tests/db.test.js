const { getDb } = require('../server/db');

describe('database', () => {
  let db;

  beforeEach(() => {
    db = getDb();
  });

  test('creates jobs and scrape_runs tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map(t => t.name);
    expect(tables).toContain('jobs');
    expect(tables).toContain('scrape_runs');
  });

  test('jobs table has required columns', () => {
    const cols = db.prepare('PRAGMA table_info(jobs)').all().map(c => c.name);
    expect(cols).toContain('id');
    expect(cols).toContain('track');
    expect(cols).toContain('title');
    expect(cols).toContain('company');
    expect(cols).toContain('apply_url');
    expect(cols).toContain('match_score');
    expect(cols).toContain('match_tier');
    expect(cols).toContain('status');
  });

  test('apply_url has UNIQUE constraint', () => {
    db.prepare('DELETE FROM jobs').run();
    db.prepare(
      "INSERT INTO jobs (track, title, company, apply_url) VALUES ('it-support', 'T', 'C', 'https://a.com')"
    ).run();
    expect(() =>
      db.prepare(
        "INSERT INTO jobs (track, title, company, apply_url) VALUES ('it-support', 'T2', 'C2', 'https://a.com')"
      ).run()
    ).toThrow();
  });

  test('job status defaults to null (unset)', () => {
    db.prepare('DELETE FROM jobs').run();
    db.prepare(
      "INSERT INTO jobs (track, title, company, apply_url) VALUES ('it-support', 'T', 'C', 'https://b.com')"
    ).run();
    const job = db.prepare("SELECT status FROM jobs WHERE apply_url = 'https://b.com'").get();
    expect(job.status).toBeNull();
  });
});
