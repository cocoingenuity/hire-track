const tracks = require('../../config/tracks');

async function scrape(trackId) {
  const track = tracks.find(t => t.id === trackId);
  if (!track) throw new Error(`Unknown track: ${trackId}`);

  if (process.env.DRY_RUN === 'true') {
    const fixtures = require('./fixtures.json');
    return (fixtures[trackId] || []).map(job => ({ ...job, source: 'fixture' }));
  }

  // Run both scrapers sequentially; merge results (DB UNIQUE on apply_url handles dedup)
  const { scrape: scrapeIndeed } = require('./indeed');
  const { scrape: scrapeLinkedIn } = require('./linkedin');

  const [indeedJobs, linkedInJobs] = await Promise.allSettled([
    scrapeIndeed(track),
    scrapeLinkedIn(track),
  ]).then(results =>
    results.map((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[scraper] ${i === 0 ? 'indeed' : 'linkedin'} failed: ${r.reason?.message}`);
        return [];
      }
      return r.value;
    })
  );

  console.log(`[scraper] indeed=${indeedJobs.length} linkedin=${linkedInJobs.length}`);
  return [...indeedJobs, ...linkedInJobs];
}

module.exports = { scrape };
