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

  let jobsFound = 0;
  let jobsNew   = 0;

  // Prepare statements once; reused for every job the scraper emits.
  const insertJob = db.prepare(`
    INSERT INTO jobs (track, title, company, location, date_posted, description, apply_url, source, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `);
  const updateRun = db.prepare(
    'UPDATE scrape_runs SET jobs_found = ?, jobs_new = ?, jobs_analyzed = ? WHERE id = ?'
  );

  // Called by the scraper for each valid job card as it is parsed — not after all pages finish.
  // This makes jobs_found / jobs_new update in real time so the polling UI sees live progress.
  async function onJob(job) {
    jobsFound++;
    try {
      insertJob.run(
        trackId, job.title, job.company,
        job.location    || null, job.date_posted || null,
        job.description || null, job.apply_url,
        job.source      || 'linkedin'
      );
      jobsNew++;
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) throw err;
    }
    updateRun.run(jobsFound, jobsNew, 0, runId);
  }

  await scrape(trackId, onJob);

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

  if (run.status !== 'done') return res.json(run);

  // Compute human-readable summary for the frontend toast
  const newAdded   = run.jobs_new      || 0;
  const found      = run.jobs_found    || 0;
  const analyzed   = run.jobs_analyzed || 0;
  const duplicates = found - newAdded;

  let message, toastType;
  if (analyzed > 0 && newAdded === 0) {
    // Batch analysis run
    message   = `${analyzed} job${analyzed === 1 ? '' : 's'} analyzed.`;
    toastType = 'success';
  } else if (newAdded > 0) {
    message   = `${newAdded} new job${newAdded === 1 ? '' : 's'} added${duplicates > 0 ? ` · ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : ''}.`;
    toastType = 'success';
  } else {
    message   = `No new jobs found — all ${found} scraped were already in your list.`;
    toastType = 'info';
  }

  res.json({ ...run, duplicates, message, toastType });
});

module.exports = router;
