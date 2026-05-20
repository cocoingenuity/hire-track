const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { analyze } = require('../analyzer');
const { getResumeText } = require('../resumes');

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

  const unanalyzed = db
    .prepare('SELECT * FROM jobs WHERE track = ? AND analyzed_at IS NULL ORDER BY scraped_at DESC')
    .all(trackId);

  console.log(`[analyze/${trackId}] ${unanalyzed.length} jobs to analyze`);

  let jobsAnalyzed = 0;
  updateRun.run(unanalyzed.length, 0, jobsAnalyzed, runId);

  for (const job of unanalyzed) {
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
          noc_code = ?, noc_explanation = ?,
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
  }

  db.prepare(
    "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
  ).run(runId);
}

module.exports = router;
