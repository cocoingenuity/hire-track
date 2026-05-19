require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Init DB at startup
getDb();

app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/scrape', require('./routes/scrape'));

module.exports = app;
