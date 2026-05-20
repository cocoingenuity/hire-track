const tracks = require('../../config/tracks');

async function scrape(trackId) {
  const track = tracks.find(t => t.id === trackId);
  if (!track) throw new Error(`Unknown track: ${trackId}`);

  if (process.env.DRY_RUN === 'true') {
    const fixtures = require('./fixtures.json');
    return (fixtures[trackId] || []).map(job => ({ ...job, source: 'fixture' }));
  }

  // Run scrapers sequentially — each launches a Chromium instance; concurrent launches
  // double peak RAM and defeat the per-scraper rate-limit delays.
  const { scrape: scrapeIndeed } = require('./indeed');
  const { scrape: scrapeLinkedIn } = require('./linkedin');

  let indeedJobs = [];
  let linkedInJobs = [];

  try { indeedJobs = await scrapeIndeed(track); }
  catch (err) { console.error(`[scraper] indeed failed: ${err.message}`); }

  try { linkedInJobs = await scrapeLinkedIn(track); }
  catch (err) { console.error(`[scraper] linkedin failed: ${err.message}`); }

  console.log(`[scraper] indeed=${indeedJobs.length} linkedin=${linkedInJobs.length}`);
  return [...indeedJobs, ...linkedInJobs];
}

module.exports = { scrape };
