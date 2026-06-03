const tracks = require('../../config/tracks');

async function scrape(trackId, onJob) {
  const track = tracks.find(t => t.id === trackId);
  if (!track) throw new Error(`Unknown track: ${trackId}`);

  if (process.env.DRY_RUN === 'true') {
    const fixtures = require('./fixtures.json');
    const jobs = (fixtures[trackId] || []).map(job => ({ ...job, source: 'fixture' }));
    for (const job of jobs) {
      await onJob(job);
      // Small delay so the ScrapeProgress bar shows incremental counts in DRY_RUN mode
      await new Promise(r => setTimeout(r, 150));
    }
    return;
  }

  const { scrape: scrapeLinkedIn } = require('./linkedin');
  await scrapeLinkedIn(track, onJob);
}

module.exports = { scrape };
