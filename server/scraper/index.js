const tracks = require('../../config/tracks');

async function scrape(trackId) {
  const track = tracks.find(t => t.id === trackId);
  if (!track) throw new Error(`Unknown track: ${trackId}`);

  if (process.env.DRY_RUN === 'true') {
    const fixtures = require('./fixtures.json');
    return (fixtures[trackId] || []).map(job => ({ ...job, source: 'fixture' }));
  }

  const provider = process.env.SCRAPER_SOURCE || 'indeed';
  const { scrape: providerScrape } = require(`./${provider}`);
  return providerScrape(track);
}

module.exports = { scrape };
