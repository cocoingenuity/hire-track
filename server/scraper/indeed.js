const { chromium } = require('playwright');

const DELAY = () => 2000 + Math.random() * 2000;

function parsePostedDate(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  const now = new Date();

  if (/just posted|today/.test(t)) return now.toISOString().split('T')[0];

  const h = t.match(/(\d+)\s*hour/);
  if (h) return now.toISOString().split('T')[0];

  const d = t.match(/(\d+)\s*day/);
  if (d) {
    const date = new Date(now);
    date.setDate(date.getDate() - parseInt(d[1]));
    return date.toISOString().split('T')[0];
  }

  const w = t.match(/(\d+)\s*week/);
  if (w) {
    const date = new Date(now);
    date.setDate(date.getDate() - parseInt(w[1]) * 7);
    return date.toISOString().split('T')[0];
  }

  return null;
}

async function getPostedDate(context, url) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);
    const raw = await page.evaluate(() => {
      const selectors = [
        '[data-testid="job-posted-date"]',
        '[class*="jobPosted"]',
        '[class*="postedDate"]',
        '[class*="posted"]',
        '[class*="date"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const t = (el.innerText || el.textContent || '').trim();
          if (t && /ago|today|posted|hour|day|week/i.test(t)) return t;
        }
      }
      const body = document.body.innerText || '';
      const m = body.match(/(?:active|posted)\s+(\d+\s+(?:hour|day|week)s?\s+ago|[Tt]oday|[Jj]ust\s+[Pp]osted)/i);
      return m ? m[0].trim() : '';
    }).catch(() => '');
    return raw;
  } catch {
    return '';
  } finally {
    await page.close();
  }
}

async function scrape(track) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  const allJobs = [];
  let debuggedFirstCard = false;

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
            if (!debuggedFirstCard) {
              debuggedFirstCard = true;
              const rawText = await card.evaluate(el =>
                (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 400)
              ).catch(() => '(error)');
              console.log('[scraper] First card text:', rawText);
            }

            const title = await card
              .$eval('h2.jobTitle span', el => el.textContent.trim())
              .catch(() => '');
            const company = await card
              .$eval('[data-testid="company-name"]', el => el.textContent.trim())
              .catch(() => '');
            const location = await card
              .$eval('[data-testid="text-location"]', el => el.textContent.trim())
              .catch(() => '');

            // Try card-level date extraction first (fast path)
            const cardDateText = await card.evaluate(el => {
              const selectors = [
                '[data-testid*="date"]', '[data-testid*="Date"]',
                'span.date', '[class*="date"]', '[class*="Date"]',
                '[class*="age"]', '[class*="Age"]', '[class*="posted"]', '[class*="Posted"]',
              ];
              for (const sel of selectors) {
                const found = el.querySelector(sel);
                if (found) {
                  const t = (found.innerText || found.textContent || '').trim();
                  if (t && /ago|today|posted|hour|day|week/i.test(t)) return t;
                }
              }
              const visibleText = (el.innerText || el.textContent || '');
              const m = visibleText.match(/(?:active|posted)?\s*(\d+\s+(?:hour|day|week)s?\s+ago|[Tt]oday|[Jj]ust\s+[Pp]osted)/i);
              return m ? m[0].trim() : '';
            }).catch(() => '');

            // Skip stale listings (30+ days old)
            if (/30\+|\bmonth\b/i.test(cardDateText)) continue;

            const description = await card.evaluate(el => {
              for (const sel of ['[class*="snippet"]', '[class*="Snippet"]', '[class*="description"]', 'ul']) {
                const found = el.querySelector(sel);
                if (found) {
                  const text = found.textContent.trim();
                  if (text.length > 30) return text;
                }
              }
              return '';
            }).catch(() => '');

            const href = await card
              .$eval('h2.jobTitle a', el => el.getAttribute('href'))
              .catch(() => '');
            const applyUrl = href
              ? href.startsWith('http') ? href : `https://ca.indeed.com${href}`
              : '';

            if (!title || !applyUrl) continue;

            // Parse card date; if missing, visit the job detail page
            let date_posted = parsePostedDate(cardDateText);
            if (!date_posted) {
              const detailDateText = await getPostedDate(context, applyUrl);
              date_posted = parsePostedDate(detailDateText);
              console.log(`[scraper] detail date "${title.substring(0, 40)}": "${detailDateText}" → ${date_posted}`);
            }

            allJobs.push({ title, company, location, date_posted, description, apply_url: applyUrl, source: 'indeed' });
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
