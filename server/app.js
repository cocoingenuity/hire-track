require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');
const { loadResumes } = require('./resumes');

const app = express();
app.use(cors());
app.use(express.json());

getDb();

if (process.env.NODE_ENV !== 'test') {
  const key = process.env.GEMINI_API_KEY || '';
  const keyStatus = key ? `set (${key.substring(0, 8)}...)` : 'NOT SET — analysis will fail';
  console.log(`[startup] GEMINI_API_KEY: ${keyStatus}`);
  console.log(`[startup] GEMINI_MODEL: ${process.env.GEMINI_MODEL || '(not set, defaults to gemini-2.0-flash)'}`);
  console.log(`[startup] AI_PROVIDER: ${process.env.AI_PROVIDER || '(not set, defaults to gemini)'}`);
  console.log(`[startup] DRY_RUN: ${process.env.DRY_RUN || 'false'}`);

  loadResumes().catch(err => console.error('[resumes] Load error:', err.message));
}

app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/scrape', require('./routes/scrape'));

module.exports = app;
