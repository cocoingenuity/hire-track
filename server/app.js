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
  loadResumes().catch(err => console.error('[resumes] Load error:', err.message));
}

app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/scrape', require('./routes/scrape'));

module.exports = app;
