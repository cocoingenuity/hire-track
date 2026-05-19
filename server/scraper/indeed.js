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

// Visit the job detail page, follow the company name link to the company jobs page,
// then find this specific job's card (matched by jk key) to extract the posting date.
async function getJobDateViaCompanyPage(context, applyUrl, title) {
  const jkMatch = applyUrl.match(/[?&]jk=([^&]+)/);
  const jk = jkMatch ? jkMatch[1] : null;

  const page = await context.newPage();
  try {
    // Step 1: visit job detail page
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(1500);

    // Step 2: find the company name link (href contains /cmp/)
    const companyHref = await page.evaluate(() => {
      const selectors = [
        'a[data-testid="inlineHeader-companyName"]',
        '[class*="companyName"] a[href*="/cmp/"]',
        'a[href*="/cmp/"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el.getAttribute('href');
      }
      return null;
    }).catch(() => null);

    if (!companyHref) {
      console.log(`[scraper] no /cmp/ link on detail page for "${title.substring(0, 40)}"`);
      return '';
    }

    // Build base company URL (strip query params / sub-paths after the slug)
    const fullCompanyUrl = companyHref.startsWith('http')
      ? companyHref
      : `https://ca.indeed.com${companyHref.startsWith('/') ? companyHref : '/' + companyHref}`;
    const cmpMatch = fullCompanyUrl.match(/(https:\/\/[^/]+\/cmp\/[^/?#]+)/);
    const baseCompanyUrl = cmpMatch ? cmpMatch[1] : fullCompanyUrl.split('?')[0];

    // Step 3: navigate to the company's jobs page
    await page.goto(`${baseCompanyUrl}/jobs`, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(1500);

    // Step 4: find the date for this specific job
    const dateText = await page.evaluate((jk, title) => {
      function extractDateNear(el) {
        let node = el;
        for (let i = 0; i < 7; i++) {
          node = node.parentElement;
          if (!node) break;
          // Check all descendants of the ancestor for date-like leaf text
          for (const child of node.querySelectorAll('*')) {
            if (child.children.length > 0) continue; // leaf nodes only
            const t = (child.innerText || child.textContent || '').trim();
            if (/^(\d+\s+(hour|day|week)s?\s+ago|[Tt]oday|[Jj]ust\s+[Pp]osted)$/i.test(t)) return t;
          }
        }
        return '';
      }

      // Primary: find job card linked by jk key
      if (jk) {
        const link = document.querySelector(`a[href*="jk=${jk}"]`);
        if (link) {
          const d = extractDateNear(link);
          if (d) return d;
        }
      }

      // Fallback: match by title text in any heading-like element
      const headings = document.querySelectorAll('h2, h3, [class*="jobTitle"], [class*="title"]');
      for (const h of headings) {
        const text = (h.innerText || h.textContent || '').trim();
        if (text.length > 4 && title.toLowerCase().includes(text.toLowerCase().substring(0, 14))) {
          const d = extractDateNear(h);
          if (d) return d;
        }
      }

      return '';
    }, jk, title).catch(() => '');

    return dateText;
  } catch (err) {
    console.log(`[scraper] company page error for "${title.substring(0, 40)}": ${err.message.substring(0, 60)}`);
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

            // Quick card-level stale check (30+ days / month text in card)
            const cardDateText = await card.evaluate(el => {
              const visibleText = (el.innerText || el.textContent || '');
              const m = visibleText.match(/(?:active|posted)?\s*(\d+\s+(?:hour|day|week)s?\s+ago|[Tt]oday|[Jj]ust\s+[Pp]osted)/i);
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

            // Get real posting date via company page
            const dateRaw = await getJobDateViaCompanyPage(context, applyUrl, title);
            const date_posted = parsePostedDate(dateRaw);
            console.log(`[scraper] "${title.substring(0, 45)}" → "${dateRaw}" → ${date_posted}`);

            // 14-day freshness filter — skip stale jobs entirely
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
