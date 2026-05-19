const { chromium } = require('playwright');

const DELAY = () => 2000 + Math.random() * 2000;

function parsePostedDate(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  const now = new Date();

  if (/30\+/.test(t)) return null; // "30+ days ago" → too old to parse meaningfully

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

// Single-page date extraction from the job detail page.
// Only called when the search results card contains no date text.
async function getJobDateFromDetailPage(context, applyUrl, title) {
  const page = await context.newPage();
  try {
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const dateText = await page.evaluate(() => {
      const selectors = [
        '[data-testid="job-age"]',
        '[data-testid*="date"]',
        '[class*="PostedDate"]',
        '[class*="postedDate"]',
        '[class*="datePosted"]',
        '[class*="job-age"]',
        'time',
        '[class*="jobMetadata"] span',
        '[class*="jobInfoItem"]',
      ];
      const dateRe = /(\d+\s+(?:hour|day|week)s?\s+ago|today|just\s+posted)/i;
      for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) {
          const t = (el.innerText || el.textContent || '').trim();
          if (dateRe.test(t)) return t;
        }
      }
      // Line-anchored body scan — avoids matching dates inside job description prose
      const body = document.body ? (document.body.innerText || '') : '';
      const m = body.match(/^(\d+\s+(?:hour|day|week)s?\s+ago|[Tt]oday|[Jj]ust\s+[Pp]osted)$/im);
      return m ? m[0].trim() : '';
    }).catch(() => '');

    if (dateText) console.log(`[scraper] detail page date for "${title.substring(0, 40)}": "${dateText}"`);
    return dateText;
  } catch (err) {
    console.log(`[scraper] detail page error for "${title.substring(0, 40)}": ${err.message.substring(0, 60)}`);
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
        // fromage=14 filters to last 14 days at the source; belt+suspenders with the in-code filter below
        const url =
          `https://ca.indeed.com/jobs?q=${encodeURIComponent(query)}` +
          `&l=Ottawa%2C+ON&fromage=14&start=${pageNum * 10}`;

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(DELAY());

        const cards = await page.$$('div.job_seen_beacon, [data-testid="slider_container"]');
        if (cards.length === 0) break;

        for (const card of cards) {
          try {
            if (!debuggedFirstCard) {
              debuggedFirstCard = true;
              const rawHtml = await card.evaluate(el => el.outerHTML).catch(() => '(error)');
              console.log('[scraper] First card HTML:', rawHtml);
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

            // Extract date text from card — try specific selectors first, then full-text scan
            const cardDateText = await card.evaluate(el => {
              const dateRe = /(\d+\+?\s*(?:hour|day|week)s?\s*ago|[Tt]oday|[Jj]ust\s+[Pp]osted)/i;
              const dateSelectors = [
                '[data-testid="myJobsStateDate"]',
                '[data-testid="job-age"]',
                '[data-testid*="date"]',
                '[class*="date"]',
                '[class*="Date"]',
                '[class*="age"]',
                'time',
              ];
              for (const sel of dateSelectors) {
                for (const elem of el.querySelectorAll(sel)) {
                  const t = (elem.innerText || elem.textContent || '').trim();
                  const m = t.match(dateRe);
                  if (m) return m[0].trim();
                }
              }
              const text = el.innerText || el.textContent || '';
              const m = text.match(dateRe);
              return m ? m[0].trim() : '';
            }).catch(() => '');

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
            const rawUrl = href
              ? href.startsWith('http') ? href : `https://ca.indeed.com${href}`
              : '';
            const jkMatch = rawUrl.match(/[?&]jk=([^&]+)/);
            const applyUrl = jkMatch
              ? `https://ca.indeed.com/viewjob?jk=${jkMatch[1]}`
              : rawUrl;

            if (!title || !applyUrl) continue;

            // Primary: use date from card. Fallback: visit detail page once.
            const dateRaw = cardDateText || await getJobDateFromDetailPage(context, applyUrl, title);
            const date_posted = parsePostedDate(dateRaw);
            console.log(`[scraper] "${title.substring(0, 45)}" → "${dateRaw}" → ${date_posted}`);

            // 14-day freshness filter (fromage=14 already handles this at source)
            if (date_posted) {
              const ageDays = (Date.now() - new Date(date_posted).getTime()) / 86400000;
              if (ageDays > 14) {
                console.log(`[scraper] skip stale (${Math.round(ageDays)}d old)`);
                continue;
              }
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
