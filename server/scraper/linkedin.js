const { chromium } = require('playwright');

const DELAY = () => 3000 + Math.random() * 3000;

// Word-boundary match for common French job title words
const FRENCH_TITLE_RE = /\b(subalterne|analyste|agente|responsable|adjointe?|coordonnatrice?|coordonnateur|technicienne?|sp[eé]cialiste|conseill[eè]re?|directrice|directeur|gestionnaire|ing[eé]nieure?|charg[eé]e?|principale?|soutien|pr[eé]pos[eé]e?|administratrice?|op[eé]rateur|op[eé]ratrice)\b/i;

// IT/tech allowlist — title must contain at least one of these to be imported
const IT_TITLE_RE = /\b(support|systems?|network|technician|help[\s-]?desk|desktop|infrastructure|security|analyst|administrator|engineer|specialist|coordinator|technical|cyber|cloud|data)\b/i;
const IT_ACRONYM_RE = /\bIT\b/; // case-sensitive to avoid matching "it"

const DESC_BLOCKERS = [
  'secret clearance',
  'top secret',
  'reliability clearance required',
  'must be canadian citizen',
  'canadian citizenship required',
  'must be pr',
  'pr required',
  'bilingual',
  'french required',
  "valid g driver's license",
  "g driver's license required",
  'g license required',
];

function shouldFilter(title, description) {
  if (FRENCH_TITLE_RE.test(title || '')) return true;
  const descLower = (description || '').toLowerCase();
  if (DESC_BLOCKERS.some(phrase => descLower.includes(phrase))) return true;
  // Reject non-IT titles
  if (!IT_TITLE_RE.test(title || '') && !IT_ACRONYM_RE.test(title || '')) return true;
  return false;
}

// f_TPR=r259200 → past 3 days (259200 seconds)
const TIME_FILTER = 'r259200';

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

        // Detect login wall / authwall before waiting or scraping
        const landedUrl = page.url();
        if (
          landedUrl.includes('/login') ||
          landedUrl.includes('authwall') ||
          landedUrl.includes('checkpoint')
        ) {
          const err = new Error(`LINKEDIN_AUTH_WALL: redirected to ${landedUrl}`);
          err.authWall = true;
          throw err;
        }

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

            const description = await card.evaluate(el => {
              for (const sel of ['.job-search-card__snippet', '[class*="snippet"]', '[class*="description"]']) {
                const found = el.querySelector(sel);
                if (found) {
                  const text = found.textContent.trim();
                  if (text.length > 20) return text;
                }
              }
              return '';
            }).catch(() => '');

            if (shouldFilter(title, description)) {
              console.log(`[linkedin] FILTERED "${title.substring(0, 45)}"`);
              continue;
            }

            console.log(`[linkedin] "${title.substring(0, 45)}" → ${date_posted}`);

            allJobs.push({
              title,
              company,
              location,
              date_posted,
              description,
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
