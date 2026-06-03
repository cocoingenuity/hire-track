const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { getDb } = require('../db');
const { reloadResume } = require('../resumes');

const RESUMES_DIR = path.join(__dirname, '../../resumes');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RESUMES_DIR),
  filename: (req, file, cb) => cb(null, `${req.params.id}.pdf`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are accepted'));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/', (req, res) => {
  const db = getDb();
  const tracks = db
    .prepare('SELECT id, name, emoji, resume_file_path FROM job_tracks ORDER BY created_at ASC')
    .all();
  res.json(tracks);
});

router.post('/', (req, res) => {
  const { id, name, emoji } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });

  const db = getDb();
  try {
    db.prepare('INSERT INTO job_tracks (id, name, emoji) VALUES (?, ?, ?)').run(id, name, emoji || '');
    db.prepare('INSERT OR IGNORE INTO user_strategy (track_id, target_roles) VALUES (?, ?)').run(id, name);
    const track = db.prepare('SELECT * FROM job_tracks WHERE id = ?').get(id);
    res.json(track);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Track ID already exists' });
    }
    throw err;
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  db.prepare('DELETE FROM job_tracks WHERE id = ?').run(id);
  db.prepare('DELETE FROM user_strategy WHERE track_id = ?').run(id);
  res.json({ ok: true });
});

router.post('/:id/resume', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { id } = req.params;
  const filename = req.file.filename;
  const db = getDb();
  db.prepare('UPDATE job_tracks SET resume_file_path = ? WHERE id = ?').run(filename, id);
  await reloadResume(id, filename);
  res.json({ ok: true, filename });
});

module.exports = router;
