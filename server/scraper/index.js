const configTracks = require('../../config/tracks');
const { getDb } = require('../db');
const { expandQueries } = require('./expandQueries');

async function scrape(trackId, onJob) {
  // Config tracks have curated query lists — use them as-is.
  let track = configTracks.find(t => t.id === trackId);

  if (!track) {
    // DB-only track (created via the UI): build queries dynamically.
    const db = getDb();
    const dbTrack = db.prepare('SELECT * FROM job_tracks WHERE id = ?').get(trackId);
    if (!dbTrack) throw new Error(`Unknown track: ${trackId}`);

    const stratRow = db.prepare('SELECT target_roles FROM user_strategy WHERE track_id = ?').get(trackId);
    const rolesRaw = stratRow?.target_roles?.trim() || '';

    // Ask the AI to expand the track name into effective LinkedIn search queries.
    // Falls back to splitting target_roles (or track name) if the AI call fails.
    let queries = null;

    const expanded = await expandQueries(dbTrack.name, rolesRaw);
    if (expanded) {
      queries = expanded.map(q => `${q} Ottawa`);
    } else {
      const fallbackRoles = rolesRaw || dbTrack.name;
      queries = fallbackRoles
        .split(',')
        .map(r => r.trim())
        .filter(Boolean)
        .map(r => `${r} Ottawa`);
      if (queries.length === 0) queries.push(`${dbTrack.name} Ottawa`);
    }

    console.log(`[scraper] "${trackId}" queries: ${queries.join(' | ')}`);
    track = { id: trackId, label: dbTrack.name, queries };
  }

  if (process.env.DRY_RUN === 'true') {
    const fixtures = require('./fixtures.json');
    const jobs = (fixtures[trackId] || fixtures[Object.keys(fixtures)[0]] || [])
      .map(job => ({ ...job, source: 'fixture' }));
    for (const job of jobs) {
      await onJob(job);
      await new Promise(r => setTimeout(r, 150));
    }
    return;
  }

  const { scrape: scrapeLinkedIn } = require('./linkedin');
  await scrapeLinkedIn(track, onJob);
}

module.exports = { scrape };
