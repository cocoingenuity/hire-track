const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

const VALID_STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

router.get('/', (req, res) => {
  const db = getDb();
  const { track, tier, status } = req.query;

  let sql = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (track)  { sql += ' AND track = ?';      params.push(track); }
  if (tier)   { sql += ' AND match_tier = ?';  params.push(tier); }
  if (status) { sql += ' AND status = ?';      params.push(status); }

  sql += ' ORDER BY match_score DESC';

  const jobs = db.prepare(sql).all(...params).map(job => ({
    ...job,
    strengths:        job.strengths        ? JSON.parse(job.strengths)        : null,
    gaps:             job.gaps             ? JSON.parse(job.gaps)             : null,
    key_requirements: job.key_requirements ? JSON.parse(job.key_requirements) : null,
    apply_recommendation: job.apply_recommendation === 1,
  }));

  res.json(jobs);
});

router.patch('/:id/status', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;

  const finalStatus = (status === '' || status == null) ? null : status;
  if (finalStatus !== null && !VALID_STATUSES.includes(finalStatus)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const result = db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(finalStatus, Number(id));
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(Number(id));
  res.json(job);
});

module.exports = router;
