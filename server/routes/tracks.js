const express = require('express');
const router = express.Router();
const allTracks = require('../../config/tracks');

router.get('/', (req, res) => {
  // Strip resume paths — server-only config
  const tracks = allTracks.map(({ id, label, emoji, queries }) => ({
    id,
    label,
    emoji,
    queries
  }));
  res.json(tracks);
});

module.exports = router;
