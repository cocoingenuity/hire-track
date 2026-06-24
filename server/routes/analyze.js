const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { analyze } = require('../analyzer');
const { detectHardBlockers, applyHardBlockers } = require('../analyzer/blockers');
const { getResumeText } = require('../resumes');
const { resume, isPaused, isStopped } = require('../pause');
const { getStrategy } = require('../strategy');
const { getProfile } = require('../profile');

// POST /api/analyze/batch  { jobIds: [1,2,3], trackId: "it-support" }
router.post('/batch', (req, res) => {
  const { jobIds, trackId } = req.body;
  if (!Array.isArray(jobIds) || jobIds.length === 0 || !trackId) {
    return res.status(400).json({ error: 'jobIds (array) and trackId required' });
  }

  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM scrape_runs WHERE track = ? AND status = 'running'")
    .get(trackId);

  if (existing) {
    return res.json({ run_id: existing.id });
  }

  const { lastInsertRowid: runId } = db
    .prepare("INSERT INTO scrape_runs (track, status, jobs_found) VALUES (?, 'running', ?)")
    .run(trackId, jobIds.length);

  runBatchAnalysis(db, trackId, runId, jobIds).catch(err => {
    db.prepare(
      "UPDATE scrape_runs SET status = 'error', error_msg = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(err.message, runId);
  });

  res.json({ run_id: runId });
});

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

  runAnalysisJob(db, track, runId).catch(err => {
    db.prepare(
      "UPDATE scrape_runs SET status = 'error', error_msg = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(err.message, runId);
  });

  res.json({ run_id: runId });
});

async function runAnalysisJob(db, trackId, runId) {
  resume(trackId); // clear any stale pause flag from a previous run

  const updateRun = db.prepare(
    'UPDATE scrape_runs SET jobs_found = ?, jobs_new = ?, jobs_analyzed = ? WHERE id = ?'
  );

  const resumeText = getResumeText(trackId);
  if (!resumeText) {
    console.log(`[analyze/${trackId}] No resume — skipping analysis`);
    db.prepare(
      "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
    ).run(runId);
    return;
  }

  const strategy = { ...getProfile(db), ...getStrategy(db, trackId) };
  console.log(`[analyze/${trackId}] strategy: visa=${strategy.visa_status} langs=${strategy.languages.join(',')} vehicle=${strategy.has_vehicle} clearance=${strategy.security_clearance}`);

  const unanalyzed = db
    .prepare('SELECT * FROM jobs WHERE track = ? AND analyzed_at IS NULL ORDER BY scraped_at DESC')
    .all(trackId);

  console.log(`[analyze/${trackId}] ${unanalyzed.length} jobs to analyze`);

  let jobsAnalyzed = 0;
  updateRun.run(unanalyzed.length, 0, jobsAnalyzed, runId);

  for (const job of unanalyzed) {
    if (isPaused(trackId) || isStopped(trackId)) {
      const stopped = isStopped(trackId);
      console.log(`[analyze/${trackId}] ${stopped ? 'Stopped' : 'Paused'} before job ${job.id}`);
      db.prepare('UPDATE scrape_runs SET status = ? WHERE id = ?').run(stopped ? 'done' : 'paused', runId);
      return;
    }

    const jobContext = [
      job.title,
      job.company && `Company: ${job.company}`,
      job.location && `Location: ${job.location}`,
      job.description,
    ].filter(Boolean).join('\n');

    console.log(`[analyzer] → "${job.title.substring(0, 50)}" (id=${job.id})`);
    try {
      const raw = await analyze(resumeText, jobContext, strategy);
      const blocked = detectHardBlockers(jobContext, strategy);
      const result = applyHardBlockers(raw, blocked);
      console.log(`[analyzer] ✓ score=${result.match_score} tier="${result.match_tier}"${blocked.length ? ` (gated: ${blocked.length})` : ''}`);
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
        console.error('[analyzer] Daily quota exhausted — aborting');
        break;
      }
    }
    updateRun.run(unanalyzed.length, 0, jobsAnalyzed, runId);

    if (isPaused(trackId) || isStopped(trackId)) {
      const stopped = isStopped(trackId);
      console.log(`[analyze/${trackId}] ${stopped ? 'Stopped' : 'Paused'} after job ${job.id}`);
      db.prepare('UPDATE scrape_runs SET status = ? WHERE id = ?').run(stopped ? 'done' : 'paused', runId);
      return;
    }
  }

  db.prepare(
    "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
  ).run(runId);
}

async function runBatchAnalysis(db, trackId, runId, jobIds) {
  resume(trackId);

  const updateRun = db.prepare(
    'UPDATE scrape_runs SET jobs_found = ?, jobs_new = ?, jobs_analyzed = ? WHERE id = ?'
  );

  const resumeText = getResumeText(trackId);
  if (!resumeText) {
    console.log(`[batch/${trackId}] No resume — skipping`);
    db.prepare(
      "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
    ).run(runId);
    return;
  }

  const strategy = { ...getProfile(db), ...getStrategy(db, trackId) };
  const jobs = db
    .prepare(`SELECT * FROM jobs WHERE id IN (${jobIds.map(() => '?').join(',')})`)
    .all(...jobIds);

  console.log(`[batch/${trackId}] analyzing ${jobs.length} selected jobs`);

  let jobsAnalyzed = 0;
  updateRun.run(jobs.length, 0, jobsAnalyzed, runId);

  for (const job of jobs) {
    if (isStopped(trackId)) {
      console.log(`[batch/${trackId}] stopped`);
      db.prepare(
        "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
      ).run(runId);
      return;
    }

    const jobContext = [
      job.title,
      job.company && `Company: ${job.company}`,
      job.location && `Location: ${job.location}`,
      job.description,
    ].filter(Boolean).join('\n');

    console.log(`[batch] → "${job.title.substring(0, 50)}" (id=${job.id})`);
    try {
      const raw = await analyze(resumeText, jobContext, strategy);
      const blocked = detectHardBlockers(jobContext, strategy);
      const result = applyHardBlockers(raw, blocked);
      console.log(`[batch] ✓ score=${result.match_score} tier="${result.match_tier}"${blocked.length ? ` (gated: ${blocked.length})` : ''}`);
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
      console.error(`[batch] ✗ "${job.title.substring(0, 50)}": ${err.message.substring(0, 120)}`);
      if (err.dailyQuotaExceeded) {
        console.error('[batch] Daily quota exhausted — aborting');
        break;
      }
    }
    updateRun.run(jobs.length, 0, jobsAnalyzed, runId);
  }

  db.prepare(
    "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
  ).run(runId);
}

module.exports = router;
