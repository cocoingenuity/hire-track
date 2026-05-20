const { chromium } = require('playwright');

const DELAY = () => 3000 + Math.random() * 3000;

// f_TPR=r604800 → past 7 days (604800 seconds)
const TIME_FILTER = 'r604800';

async function scrape(track) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-CA',
    extraHTTPHeaders: {
      'Accept-Language': 'en-CA,en;q=0.9',
    },
  });
  const page = await context.newPage();
  const allJobs = [];
  const seen = new Set();

  try {
    for (const query of track.queries) {
      for (let start = 0; start < 50; start += 25) {
        const url =
          `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}` +
          `&location=Ottawa%2C%20Ontario%2C%20Canada&f_TPR=${TIME_FILTER}&start=${start}`;

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(DELAY());

        // Expand lazy-loaded cards
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);

        const cards = await page.$$('ul.jobs-search__results-list > li, div.base-card');
        if (cards.length === 0) break;

        console.log(`[linkedin] "${query}" start=${start} → ${cards.length} cards`);

        for (const card of cards) {
          try {
            const title = await card
              .$eval('h3.base-search-card__title', el => el.textContent.trim())
              .catch(() => '');
            const company = await card
              .$eval('h4.base-search-card__subtitle', el => el.textContent.trim())
              .catch(() => '');
            const location = await card
              .$eval('span.job-search-card__location', el => el.textContent.trim())
              .catch(() => '');

            // LinkedIn encodes the date in a machine-readable datetime attribute
            const dateAttr = await card
              .$eval('time[datetime]', el => el.getAttribute('datetime'))
              .catch(() => '');
            const date_posted = dateAttr ? dateAttr.split('T')[0] : null;

            const href = await card
              .$eval('a.base-card__full-link, a.base-search-card__full-link', el => el.getAttribute('href'))
              .catch(() => '');

            if (!href || !title) continue;

            // Normalize to /jobs/view/{id}/ — strip tracking params
            const idMatch = href.match(/\/jobs\/view\/(\d+)/);
            const applyUrl = idMatch
              ? `https://www.linkedin.com/jobs/view/${idMatch[1]}/`
              : href.split('?')[0];

            if (seen.has(applyUrl)) continue;
            seen.add(applyUrl);

            console.log(`[linkedin] "${title.substring(0, 45)}" → ${date_posted}`);

            allJobs.push({
              title,
              company,
              location,
              date_posted,
              description: '',
              apply_url: applyUrl,
              source: 'linkedin',
            });
          } catch {
            // Skip malformed cards
          }
        }

        await page.waitForTimeout(DELAY());
      }
    }
  } finally {
    await browser.close();
  }

  return allJobs;
}

module.exports = { scrape };
