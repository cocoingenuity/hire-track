const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { getDb } = require('./db');

const RESUMES_DIR = path.join(__dirname, '../resumes');
const cache = {};

async function loadOne(trackId, filename) {
  const resumePath = path.join(RESUMES_DIR, filename);
  if (!fs.existsSync(resumePath)) {
    console.warn(`[resumes] Warning: missing resume for "${trackId}" at ${resumePath}`);
    return;
  }
  try {
    const buffer = fs.readFileSync(resumePath);
    const data = await pdfParse(buffer);
    cache[trackId] = data.text;
    console.log(`[resumes] Loaded "${trackId}" resume — ${data.text.length} characters`);
  } catch (err) {
    console.warn(`[resumes] Failed to parse "${trackId}" resume: ${err.message}`);
  }
}

async function loadResumes() {
  const db = getDb();
  const tracks = db.prepare('SELECT id, resume_file_path FROM job_tracks').all();
  for (const track of tracks) {
    if (!track.resume_file_path) continue;
    await loadOne(track.id, track.resume_file_path);
  }
}

function getResumeText(trackId) {
  return cache[trackId] || null;
}

async function reloadResume(trackId, filename) {
  await loadOne(trackId, filename);
}

module.exports = { loadResumes, getResumeText, reloadResume };
