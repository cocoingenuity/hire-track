const { chromium } = require('playwright');

const DELAY = () => 2000 + Math.random() * 2000; // 2–4s random delay

async function scrape(track) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  const allJobs = [];

  try {
    for (const query of track.queries) {
      for (let pageNum = 0; pageNum < 3; pageNum++) {
        const url =
          `https://ca.indeed.com/jobs?q=${encodeURIComponent(query)}` +
          `&l=Ottawa%2C+ON&start=${pageNum * 10}`;

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(DELAY());

        const cards = await page.$$('div.job_seen_beacon, [data-testid="slider_container"]');
        if (cards.length === 0) break;

        for (const card of cards) {
          try {
            const title = await card
              .$eval('h2.jobTitle span', el => el.textContent.trim())
              .catch(() => '');
            const company = await card
              .$eval('[data-testid="company-name"]', el => el.textContent.trim())
              .catch(() => '');
            const location = await card
              .$eval('[data-testid="text-location"]', el => el.textContent.trim())
              .catch(() => '');
            const dateText = await card
              .$eval('.date, [class*="date"]', el => el.textContent.trim())
              .catch(() => '');
            const description = await card
              .$eval('[class*="job-snippet"]', el => el.textContent.trim())
              .catch(() => '');
            const href = await card
              .$eval('h2.jobTitle a', el => el.getAttribute('href'))
              .catch(() => '');
            const applyUrl = href
              ? href.startsWith('http')
                ? href
                : `https://ca.indeed.com${href}`
              : '';

            if (title && applyUrl) {
              allJobs.push({
                title,
                company,
                location,
                date_posted: dateText,
                description,
                apply_url: applyUrl,
                source: 'indeed'
              });
            }
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
