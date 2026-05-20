const tracks = require('../../config/tracks');

async function scrape(trackId) {
  const track = tracks.find(t => t.id === trackId);
  if (!track) throw new Error(`Unknown track: ${trackId}`);

  if (process.env.DRY_RUN === 'true') {
    const fixtures = require('./fixtures.json');
    return (fixtures[trackId] || []).map(job => ({ ...job, source: 'fixture' }));
  }

  const { scrape: scrapeLinkedIn } = require('./linkedin');
  const jobs = await scrapeLinkedIn(track);
  console.log(`[scraper] linkedin=${jobs.length}`);
  return jobs;
}

module.exports = { scrape };
