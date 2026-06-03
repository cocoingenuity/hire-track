const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { scrape } = require('../scraper');
const { resume } = require('../pause');

router.post('/:track', (req, res) => {
  const db = getDb();
  const { track } = req.params;

  const existing = db
    .prepare("SELECT id FROM scrape_runs WHERE track = ? AND status = 'running'")
    .get(track);

  if (existing) {
    return res.json({ run_id: existing.id });
  }

  const { lastInsertRowid: runId } = db
    .prepare("INSERT INTO scrape_runs (track, status) VALUES (?, 'running')")
    .run(track);

  runScrapeJob(db, track, runId).catch(err => {
    db.prepare(
      "UPDATE scrape_runs SET status = 'error', error_msg = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(err.message, runId);
  });

  res.json({ run_id: runId });
});

async function runScrapeJob(db, trackId, runId) {
  resume(trackId);

  const updateRun = db.prepare(
    'UPDATE scrape_runs SET jobs_found = ?, jobs_new = ?, jobs_analyzed = ? WHERE id = ?'
  );

  let jobsFound = 0;
  let jobsNew = 0;

  const rawJobs = await scrape(trackId);
  db.prepare('UPDATE scrape_runs SET jobs_found = ? WHERE id = ?').run(rawJobs.length, runId);

  for (const job of rawJobs) {
    jobsFound++;
    try {
      db.prepare(`
        INSERT INTO jobs (track, title, company, location, date_posted, description, apply_url, source, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        trackId, job.title, job.company,
        job.location || null, job.date_posted || null,
        job.description || null, job.apply_url,
        job.source || 'indeed'
      );
      jobsNew++;
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) throw err;
    }
    updateRun.run(jobsFound, jobsNew, 0, runId);
  }

  console.log(`[scrape/${trackId}] done — ${jobsFound} found, ${jobsNew} new (select jobs to analyze)`);
  db.prepare(
    "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
  ).run(runId);
}

router.get('/status/:track', (req, res) => {
  const db = getDb();
  const { track } = req.params;

  const run = db
    .prepare('SELECT * FROM scrape_runs WHERE track = ? ORDER BY id DESC LIMIT 1')
    .get(track);

  if (!run) return res.json({ status: 'idle' });

  res.json(run);
});

module.exports = router;
