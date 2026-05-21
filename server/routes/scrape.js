const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { scrape } = require('../scraper');
const { analyze } = require('../analyzer');
const { getResumeText } = require('../resumes');
const { resume, isPaused } = require('../pause');

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
  resume(trackId); // clear any stale pause flag from a previous run

  const updateRun = db.prepare(
    'UPDATE scrape_runs SET jobs_found = ?, jobs_new = ?, jobs_analyzed = ? WHERE id = ?'
  );

  let jobsFound = 0;
  let jobsNew = 0;
  let jobsAnalyzed = 0;
  const newJobIds = [];

  const rawJobs = await scrape(trackId);

  // Stamp the raw count immediately so the progress banner shows something
  // during the insertion + analysis phase rather than staying at 0.
  db.prepare('UPDATE scrape_runs SET jobs_found = ? WHERE id = ?').run(rawJobs.length, runId);

  for (const job of rawJobs) {
    jobsFound++;
    try {
      const { lastInsertRowid } = db.prepare(`
        INSERT INTO jobs (track, title, company, location, date_posted, description, apply_url, source, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        trackId, job.title, job.company,
        job.location || null, job.date_posted || null,
        job.description || null, job.apply_url,
        job.source || 'indeed'
      );
      jobsNew++;
      newJobIds.push(lastInsertRowid);
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) throw err;
      // Duplicate — skip
    }
    updateRun.run(jobsFound, jobsNew, jobsAnalyzed, runId);
  }

  const resumeText = getResumeText(trackId);
  console.log(`[scrape/${trackId}] resume: ${resumeText ? resumeText.length + ' chars' : 'MISSING — analysis will be skipped'}`);

  // Only analyze jobs inserted in this run — existing jobs with no match_score
  // are processed by POST /api/analyze/:track (the backlog endpoint).
  const unanalyzed = newJobIds.length > 0
    ? db.prepare(
        `SELECT * FROM jobs WHERE id IN (${newJobIds.map(() => '?').join(',')}) ORDER BY id DESC`
      ).all(...newJobIds)
    : [];
  console.log(`[scrape/${trackId}] ${unanalyzed.length} new jobs to analyze`);

  for (const job of unanalyzed) {
    if (resumeText) {
      const jobContext = [
        job.title,
        job.company && `Company: ${job.company}`,
        job.location && `Location: ${job.location}`,
        job.description,
      ].filter(Boolean).join('\n');

      console.log(`[analyzer] → "${job.title.substring(0, 50)}" (id=${job.id})`);
      try {
        const result = await analyze(resumeText, jobContext);
        console.log(`[analyzer] ✓ score=${result.match_score} tier="${result.match_tier}"`);
        db.prepare(`
          UPDATE jobs SET
            match_score = ?, match_tier = ?,
            strengths = ?, gaps = ?, key_requirements = ?,
            apply_recommendation = ?, one_line_pitch = ?,
            noc_code = ?, noc_explanation = ?, teer_level = ?,
            analyzed_at = datetime('now')
          WHERE id = ?
        `).run(
          result.match_score, result.match_tier,
          JSON.stringify(result.strengths),
          JSON.stringify(result.gaps),
          JSON.stringify(result.key_requirements),
          result.apply_recommendation ? 1 : 0,
          result.one_line_pitch,
          result.noc_code || null,
          result.noc_explanation || null,
          result.teer_level ?? null,
          job.id
        );
        jobsAnalyzed++;
      } catch (err) {
        console.error(`[analyzer] ✗ "${job.title.substring(0, 50)}": ${err.message.substring(0, 120)}`);
        if (err.dailyQuotaExceeded) {
          console.error('[analyzer] Daily quota exhausted — aborting analysis for this run');
          break;
        }
      }
    }
    updateRun.run(jobsFound, jobsNew, jobsAnalyzed, runId);

    if (isPaused(trackId)) {
      console.log(`[scrape/${trackId}] Paused after job ${job.id}`);
      db.prepare("UPDATE scrape_runs SET status = 'paused' WHERE id = ?").run(runId);
      return;
    }
  }

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
