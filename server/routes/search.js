const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { scrapeCustom } = require('../scraper');
const { analyze } = require('../analyzer');
const { getResumeText } = require('../resumes');

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

router.post('/', (req, res) => {
  const { query, resume_track } = req.body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  if (!resume_track || typeof resume_track !== 'string') {
    return res.status(400).json({ error: 'resume_track is required' });
  }

  const db = getDb();
  const trackId = `search:${slugify(query.trim())}`;

  const existing = db
    .prepare("SELECT id FROM scrape_runs WHERE track = ? AND status = 'running'")
    .get(trackId);

  if (existing) {
    return res.json({ run_id: existing.id, track_id: trackId });
  }

  const { lastInsertRowid: runId } = db
    .prepare("INSERT INTO scrape_runs (track, status) VALUES (?, 'running')")
    .run(trackId);

  runSearchJob(db, query.trim(), trackId, resume_track, runId).catch(err => {
    db.prepare(
      "UPDATE scrape_runs SET status = 'error', error_msg = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(err.message, runId);
  });

  res.json({ run_id: runId, track_id: trackId });
});

async function runSearchJob(db, query, trackId, resumeTrack, runId) {
  const updateRun = db.prepare(
    'UPDATE scrape_runs SET jobs_found = ?, jobs_new = ?, jobs_analyzed = ? WHERE id = ?'
  );

  let jobsFound = 0;
  let jobsNew = 0;
  let jobsAnalyzed = 0;
  const newJobIds = [];

  const rawJobs = await scrapeCustom(query, trackId);
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
        job.source || 'linkedin'
      );
      jobsNew++;
      newJobIds.push(lastInsertRowid);
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) throw err;
    }
    updateRun.run(jobsFound, jobsNew, jobsAnalyzed, runId);
  }

  const resumeText = getResumeText(resumeTrack);
  console.log(`[search/${query}] resume(${resumeTrack}): ${resumeText ? resumeText.length + ' chars' : 'MISSING — analysis skipped'}`);

  const unanalyzed = newJobIds.length > 0
    ? db.prepare(
        `SELECT * FROM jobs WHERE id IN (${newJobIds.map(() => '?').join(',')}) ORDER BY id DESC`
      ).all(...newJobIds)
    : [];
  console.log(`[search/${query}] ${unanalyzed.length} new jobs to analyze`);

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
          console.error('[analyzer] Daily quota exhausted — aborting');
          break;
        }
      }
    }
    updateRun.run(jobsFound, jobsNew, jobsAnalyzed, runId);
  }

  db.prepare(
    "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
  ).run(runId);
}

module.exports = router;
