const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const tracks = require('../config/tracks');

const cache = {};

async function loadResumes() {
  for (const track of tracks) {
    const resumePath = path.resolve(track.resume);
    if (!fs.existsSync(resumePath)) {
      console.warn(`[resumes] Warning: missing resume for "${track.id}" at ${resumePath}`);
      console.warn(`[resumes] AI analysis will be skipped for this track until the file is added.`);
      continue;
    }
    try {
      const buffer = fs.readFileSync(resumePath);
      const data = await pdfParse(buffer);
      cache[track.id] = data.text;
      console.log(`[resumes] Loaded "${track.id}" resume — ${data.text.length} characters`);
    } catch (err) {
      console.warn(`[resumes] Failed to parse "${track.id}" resume: ${err.message}`);
    }
  }
}

function getResumeText(trackId) {
  return cache[trackId] || null;
}

module.exports = { loadResumes, getResumeText };
