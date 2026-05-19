# HireTrack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local job hunting assistant that scrapes Indeed.ca, scores jobs with Gemini AI, and tracks applications across configurable job tracks.

**Architecture:** Express API on `:3001` + Vite/React on `:5173`. Scraper runs as a fire-and-forget async job in Express; frontend polls `/api/scrape/status/:track` every 2s for progress. All state persisted in SQLite. Analyzer and scraper are swappable modules loaded via `AI_PROVIDER` / `SCRAPER_SOURCE` env vars. Track definitions (resume paths, queries, labels) live entirely in `config/tracks.js` — adding a track requires zero code changes.

**Tech Stack:** Node.js + Express (CommonJS), React 18 + Vite + Tailwind CSS, SQLite via `better-sqlite3`, Playwright (Chromium), Gemini API (`@google/generative-ai`), `pdf-parse`, Jest + supertest

---

## File Map

| File | Responsibility |
|---|---|
| `config/tracks.js` | All track definitions: id, label, emoji, resume path, search queries |
| `server/app.js` | Express app factory — exported for testing |
| `server/index.js` | Starts HTTP listener |
| `server/db.js` | SQLite singleton + schema init |
| `server/resumes.js` | PDF parsing + in-memory resume cache |
| `server/routes/tracks.js` | `GET /api/tracks` |
| `server/routes/jobs.js` | `GET /api/jobs`, `PATCH /api/jobs/:id/status` |
| `server/routes/scrape.js` | `POST /api/scrape/:track`, `GET /api/scrape/status/:track`, async job runner |
| `server/scraper/index.js` | Loads scraper provider from `SCRAPER_SOURCE` env |
| `server/scraper/indeed.js` | Playwright scraper for Indeed.ca |
| `server/scraper/fixtures.json` | Fake jobs for `DRY_RUN=true` |
| `server/analyzer/index.js` | Loads analyzer provider from `AI_PROVIDER` env |
| `server/analyzer/gemini.js` | Gemini 2.0 Flash implementation |
| `client/package.json` | React/Vite/Tailwind dependencies |
| `client/vite.config.js` | Dev server + `/api` proxy to `:3001` |
| `client/index.html` | HTML entry point |
| `client/tailwind.config.js` | Tailwind content paths |
| `client/postcss.config.js` | PostCSS + Tailwind plugin |
| `client/src/main.jsx` | React DOM entry |
| `client/src/index.css` | Tailwind base imports |
| `client/src/App.jsx` | Root component: track/job/filter state |
| `client/src/components/TrackTabs.jsx` | Tab bar + per-track Refresh button |
| `client/src/components/JobList.jsx` | Filtered list of JobCards |
| `client/src/components/JobCard.jsx` | Compact job row: score, tier badge, status dropdown |
| `client/src/components/JobDetail.jsx` | Expanded panel: pitch, strengths, gaps, apply link |
| `client/src/components/ScrapeProgress.jsx` | Progress bar, polls scrape status |
| `tests/setup.js` | Jest global env setup |
| `tests/tracks-config.test.js` | Track config validation |
| `tests/db.test.js` | Schema creation |
| `tests/routes/tracks.test.js` | GET /api/tracks |
| `tests/routes/jobs.test.js` | GET /api/jobs, PATCH status |
| `tests/scraper.test.js` | Dry-run scraper |
| `tests/analyzer.test.js` | Analyzer with mocked Gemini |
| `tests/routes/scrape.test.js` | Scrape route integration (dry-run) |
| `jest.config.js` | Jest config |
| `package.json` | Root deps + scripts |
| `.env.example` | Config template |
| `.gitignore` | Excludes node_modules, .env, data/, resumes/ |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `jest.config.js`
- Create: `tests/setup.js`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "hire-track",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \"npm:server\" \"npm:client\"",
    "server": "node server/index.js",
    "client": "cd client && npm run dev",
    "build": "cd client && npm run build",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "pdf-parse": "^1.1.1",
    "playwright": "^1.44.0"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

- [ ] **Step 2: Create `jest.config.js`**

```js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 15000,
  setupFiles: ['./tests/setup.js']
};
```

- [ ] **Step 3: Create `tests/setup.js`**

```js
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-key';
process.env.AI_PROVIDER = 'gemini';
process.env.SCRAPER_SOURCE = 'indeed';
process.env.DRY_RUN = 'true';
process.env.PORT = '3002';
```

- [ ] **Step 4: Create `.env.example`**

```
GEMINI_API_KEY=your_gemini_api_key_here
AI_PROVIDER=gemini
SCRAPER_SOURCE=indeed
PORT=3001
DRY_RUN=false
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
client/node_modules/
.env
data/
resumes/
.superpowers/
```

- [ ] **Step 6: Install server dependencies**

```bash
npm install
```

Expected: `node_modules/` created with express, better-sqlite3, etc.

- [ ] **Step 7: Install Playwright browsers**

```bash
npx playwright install chromium
```

Expected: Chromium browser downloaded (~170MB).

- [ ] **Step 8: Commit**

```bash
git add package.json jest.config.js tests/setup.js .env.example .gitignore
git commit -m "feat: project scaffold"
```

---

### Task 2: Track Config

**Files:**
- Create: `config/tracks.js`
- Create: `tests/tracks-config.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/tracks-config.test.js
const tracks = require('../config/tracks');

describe('tracks config', () => {
  test('is a non-empty array', () => {
    expect(Array.isArray(tracks)).toBe(true);
    expect(tracks.length).toBeGreaterThan(0);
  });

  test('each track has required fields', () => {
    for (const track of tracks) {
      expect(typeof track.id).toBe('string');
      expect(typeof track.label).toBe('string');
      expect(typeof track.emoji).toBe('string');
      expect(typeof track.resume).toBe('string');
      expect(Array.isArray(track.queries)).toBe(true);
      expect(track.queries.length).toBeGreaterThan(0);
    }
  });

  test('track ids are unique', () => {
    const ids = tracks.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/tracks-config.test.js
```

Expected: FAIL — "Cannot find module '../config/tracks'"

- [ ] **Step 3: Create `config/tracks.js`**

```js
module.exports = [
  {
    id: 'it-support',
    label: 'IT Support',
    emoji: '🖥️',
    resume: './resumes/it-support.pdf',
    queries: [
      'IT Support Specialist Ottawa',
      'Helpdesk Analyst Ottawa',
      'Technical Support Ottawa'
    ]
  },
  {
    id: 'admin',
    label: 'Admin',
    emoji: '📋',
    resume: './resumes/admin.pdf',
    queries: [
      'Administrative Assistant Ottawa',
      'Office Coordinator Ottawa',
      'Operations Assistant Ottawa'
    ]
  },
  {
    id: 'retail',
    label: 'Retail+',
    emoji: '🍎',
    resume: './resumes/retail.pdf',
    queries: [
      'Apple Specialist Ottawa',
      'Mobile Advisor Ottawa',
      'Retail Sales Advisor Ottawa'
    ]
  }
];
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- tests/tracks-config.test.js
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add config/tracks.js tests/tracks-config.test.js
git commit -m "feat: track config"
```

---

### Task 3: Database Module

**Files:**
- Create: `server/db.js`
- Create: `tests/db.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/db.test.js
const { getDb } = require('../server/db');

describe('database', () => {
  let db;

  beforeEach(() => {
    db = getDb();
  });

  test('creates jobs and scrape_runs tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map(t => t.name);
    expect(tables).toContain('jobs');
    expect(tables).toContain('scrape_runs');
  });

  test('jobs table has required columns', () => {
    const cols = db.prepare('PRAGMA table_info(jobs)').all().map(c => c.name);
    expect(cols).toContain('id');
    expect(cols).toContain('track');
    expect(cols).toContain('title');
    expect(cols).toContain('company');
    expect(cols).toContain('apply_url');
    expect(cols).toContain('match_score');
    expect(cols).toContain('match_tier');
    expect(cols).toContain('status');
  });

  test('apply_url has UNIQUE constraint', () => {
    db.prepare('DELETE FROM jobs').run();
    db.prepare(
      "INSERT INTO jobs (track, title, company, apply_url) VALUES ('it-support', 'T', 'C', 'https://a.com')"
    ).run();
    expect(() =>
      db.prepare(
        "INSERT INTO jobs (track, title, company, apply_url) VALUES ('it-support', 'T2', 'C2', 'https://a.com')"
      ).run()
    ).toThrow();
  });

  test('job status defaults to Saved', () => {
    db.prepare('DELETE FROM jobs').run();
    db.prepare(
      "INSERT INTO jobs (track, title, company, apply_url) VALUES ('it-support', 'T', 'C', 'https://b.com')"
    ).run();
    const job = db.prepare("SELECT status FROM jobs WHERE apply_url = 'https://b.com'").get();
    expect(job.status).toBe('Saved');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/db.test.js
```

Expected: FAIL — "Cannot find module '../server/db'"

- [ ] **Step 3: Create `server/db.js`**

```js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isTest = process.env.NODE_ENV === 'test';
const DB_PATH = isTest
  ? ':memory:'
  : path.join(__dirname, '../data/hiretrack.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  if (!isTest) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      track             TEXT NOT NULL,
      title             TEXT NOT NULL,
      company           TEXT NOT NULL,
      location          TEXT,
      date_posted       TEXT,
      description       TEXT,
      apply_url         TEXT UNIQUE,
      source            TEXT DEFAULT 'indeed',
      match_score       INTEGER,
      match_tier        TEXT,
      strengths         TEXT,
      gaps              TEXT,
      key_requirements  TEXT,
      apply_recommendation INTEGER,
      one_line_pitch    TEXT,
      analyzed_at       TEXT,
      status            TEXT DEFAULT 'Saved',
      scraped_at        TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scrape_runs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      track          TEXT NOT NULL,
      status         TEXT,
      jobs_found     INTEGER DEFAULT 0,
      jobs_new       INTEGER DEFAULT 0,
      jobs_analyzed  INTEGER DEFAULT 0,
      error_msg      TEXT,
      started_at     TEXT DEFAULT CURRENT_TIMESTAMP,
      finished_at    TEXT
    );
  `);

  return _db;
}

module.exports = { getDb };
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- tests/db.test.js
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add server/db.js tests/db.test.js
git commit -m "feat: database module and schema"
```

---

### Task 4: Express App Scaffold

**Files:**
- Create: `server/app.js`
- Create: `server/index.js`

- [ ] **Step 1: Create `server/app.js`**

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Init DB at startup
getDb();

app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/scrape', require('./routes/scrape'));

module.exports = app;
```

- [ ] **Step 2: Create `server/index.js`**

```js
const app = require('./app');
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`HireTrack API running on :${PORT}`);
});
```

- [ ] **Step 3: Create stub route files so app.js can load**

Create `server/routes/tracks.js`:
```js
const express = require('express');
const router = express.Router();
module.exports = router;
```

Create `server/routes/jobs.js`:
```js
const express = require('express');
const router = express.Router();
module.exports = router;
```

Create `server/routes/scrape.js`:
```js
const express = require('express');
const router = express.Router();
module.exports = router;
```

- [ ] **Step 4: Verify server starts**

```bash
node server/index.js
```

Expected: `HireTrack API running on :3001` (Ctrl+C to stop)

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/index.js server/routes/tracks.js server/routes/jobs.js server/routes/scrape.js
git commit -m "feat: express app scaffold with stub routes"
```

---

### Task 5: Tracks Route

**Files:**
- Modify: `server/routes/tracks.js`
- Create: `tests/routes/tracks.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/routes/tracks.test.js
const request = require('supertest');
const app = require('../../server/app');

describe('GET /api/tracks', () => {
  it('returns 200 with array of tracks', async () => {
    const res = await request(app).get('/api/tracks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each track has id, label, emoji, queries', async () => {
    const res = await request(app).get('/api/tracks');
    for (const track of res.body) {
      expect(track).toHaveProperty('id');
      expect(track).toHaveProperty('label');
      expect(track).toHaveProperty('emoji');
      expect(track).toHaveProperty('queries');
      expect(Array.isArray(track.queries)).toBe(true);
    }
  });

  it('does not expose resume file paths', async () => {
    const res = await request(app).get('/api/tracks');
    for (const track of res.body) {
      expect(track.resume).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/routes/tracks.test.js
```

Expected: FAIL — "expected 200, got 404" (stub router has no handler)

- [ ] **Step 3: Implement `server/routes/tracks.js`**

```js
const express = require('express');
const router = express.Router();
const allTracks = require('../../config/tracks');

router.get('/', (req, res) => {
  // Strip resume paths — they're server-only
  const tracks = allTracks.map(({ id, label, emoji, queries }) => ({
    id,
    label,
    emoji,
    queries
  }));
  res.json(tracks);
});

module.exports = router;
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- tests/routes/tracks.test.js
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add server/routes/tracks.js tests/routes/tracks.test.js
git commit -m "feat: GET /api/tracks route"
```

---

### Task 6: Jobs Routes

**Files:**
- Modify: `server/routes/jobs.js`
- Create: `tests/routes/jobs.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/routes/jobs.test.js
const request = require('supertest');
const app = require('../../server/app');
const { getDb } = require('../../server/db');

function seedJobs() {
  const db = getDb();
  db.prepare('DELETE FROM jobs').run();
  db.prepare(`
    INSERT INTO jobs (track, title, company, apply_url, match_score, match_tier, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('it-support', 'IT Support Specialist', 'Telesat', 'https://ex.com/1', 92, 'Strong Match', 'Saved');
  db.prepare(`
    INSERT INTO jobs (track, title, company, apply_url, match_score, match_tier, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('admin', 'Admin Assistant', 'GoC', 'https://ex.com/2', 74, 'Good Match', 'Applied');
  db.prepare(`
    INSERT INTO jobs (track, title, company, apply_url, match_score, match_tier, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('it-support', 'Helpdesk Analyst', 'Shopify', 'https://ex.com/3', 58, 'Stretch', 'Saved');
}

describe('GET /api/jobs', () => {
  beforeEach(seedJobs);

  it('returns all jobs sorted by score descending', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0].match_score).toBeGreaterThanOrEqual(res.body[1].match_score);
    expect(res.body[1].match_score).toBeGreaterThanOrEqual(res.body[2].match_score);
  });

  it('filters by track', async () => {
    const res = await request(app).get('/api/jobs?track=it-support');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every(j => j.track === 'it-support')).toBe(true);
  });

  it('filters by tier', async () => {
    const res = await request(app).get('/api/jobs?tier=Strong+Match');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].match_tier).toBe('Strong Match');
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/jobs?status=Applied');
    expect(res.status).toBe(200);
    expect(res.body.every(j => j.status === 'Applied')).toBe(true);
  });
});

describe('PATCH /api/jobs/:id/status', () => {
  beforeEach(seedJobs);

  it('updates status and returns updated job', async () => {
    const { body: jobs } = await request(app).get('/api/jobs');
    const id = jobs[0].id;

    const res = await request(app)
      .patch(`/api/jobs/${id}/status`)
      .send({ status: 'Applied' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Applied');
    expect(res.body.id).toBe(id);
  });

  it('rejects invalid status with 400', async () => {
    const { body: jobs } = await request(app).get('/api/jobs');
    const res = await request(app)
      .patch(`/api/jobs/${jobs[0].id}/status`)
      .send({ status: 'Ghosted' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for nonexistent job', async () => {
    const res = await request(app)
      .patch('/api/jobs/99999/status')
      .send({ status: 'Applied' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/routes/jobs.test.js
```

Expected: FAIL — "expected 200, got 404"

- [ ] **Step 3: Implement `server/routes/jobs.js`**

```js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

const VALID_STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

router.get('/', (req, res) => {
  const db = getDb();
  const { track, tier, status } = req.query;

  let sql = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (track)  { sql += ' AND track = ?';      params.push(track); }
  if (tier)   { sql += ' AND match_tier = ?';  params.push(tier); }
  if (status) { sql += ' AND status = ?';      params.push(status); }

  sql += ' ORDER BY match_score DESC';

  const jobs = db.prepare(sql).all(...params).map(job => ({
    ...job,
    strengths:        job.strengths        ? JSON.parse(job.strengths)        : null,
    gaps:             job.gaps             ? JSON.parse(job.gaps)             : null,
    key_requirements: job.key_requirements ? JSON.parse(job.key_requirements) : null,
    apply_recommendation: job.apply_recommendation === 1,
  }));

  res.json(jobs);
});

router.patch('/:id/status', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const result = db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, Number(id));
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(Number(id));
  res.json(job);
});

module.exports = router;
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- tests/routes/jobs.test.js
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add server/routes/jobs.js tests/routes/jobs.test.js
git commit -m "feat: GET /api/jobs and PATCH status routes"
```

---

### Task 7: Scraper Module with Dry-Run

**Files:**
- Create: `server/scraper/index.js`
- Create: `server/scraper/fixtures.json`
- Create: `tests/scraper.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/scraper.test.js
const { scrape } = require('../server/scraper');

describe('Scraper (DRY_RUN=true)', () => {
  it('returns array of jobs for it-support', async () => {
    const jobs = await scrape('it-support');
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('returns array of jobs for admin', async () => {
    const jobs = await scrape('admin');
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('returns array of jobs for retail', async () => {
    const jobs = await scrape('retail');
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('each job has required fields', async () => {
    const jobs = await scrape('it-support');
    for (const job of jobs) {
      expect(typeof job.title).toBe('string');
      expect(typeof job.company).toBe('string');
      expect(typeof job.apply_url).toBe('string');
      expect(typeof job.description).toBe('string');
    }
  });

  it('throws for unknown track', async () => {
    await expect(scrape('developer')).rejects.toThrow('Unknown track');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/scraper.test.js
```

Expected: FAIL — "Cannot find module '../server/scraper'"

- [ ] **Step 3: Create `server/scraper/fixtures.json`**

```json
{
  "it-support": [
    {
      "title": "IT Support Specialist",
      "company": "Telesat",
      "location": "Ottawa, ON",
      "date_posted": "2 days ago",
      "description": "Provide Tier 1/2 desktop support in a Windows and Active Directory environment. Manage service tickets in ServiceNow. Configure laptops, printers, and VPN access for 500+ employees. Strong troubleshooting and communication skills required.",
      "apply_url": "https://fixture.example.com/jobs/it-1"
    },
    {
      "title": "Helpdesk Analyst",
      "company": "Shopify",
      "location": "Ottawa, ON",
      "date_posted": "1 day ago",
      "description": "Support internal employees across macOS and Windows. ITIL-based ticket management. Office 365 administration, hardware provisioning, onboarding support. Strong customer service orientation required.",
      "apply_url": "https://fixture.example.com/jobs/it-2"
    },
    {
      "title": "Technical Support Analyst",
      "company": "DND",
      "location": "Ottawa, ON",
      "date_posted": "5 days ago",
      "description": "Government IT support role. Reliability security clearance required. Windows 10/11 environments, VPN troubleshooting, remote support tools. Bilingual (English/French) an asset.",
      "apply_url": "https://fixture.example.com/jobs/it-3"
    }
  ],
  "admin": [
    {
      "title": "Administrative Assistant",
      "company": "Government of Canada",
      "location": "Ottawa, ON",
      "date_posted": "3 days ago",
      "description": "Manage executive calendars, draft correspondence, coordinate meetings and travel. Advanced MS Office (Word, Excel, PowerPoint, Outlook). Experience in federal government an asset.",
      "apply_url": "https://fixture.example.com/jobs/admin-1"
    },
    {
      "title": "Office Coordinator",
      "company": "Ottawa Community Foundation",
      "location": "Ottawa, ON",
      "date_posted": "2 days ago",
      "description": "Coordinate day-to-day office operations, manage supplies and vendors, support leadership team. Strong organizational and interpersonal skills. Non-profit experience an asset.",
      "apply_url": "https://fixture.example.com/jobs/admin-2"
    },
    {
      "title": "Operations Assistant",
      "company": "Canadian Heritage",
      "location": "Ottawa, ON",
      "date_posted": "7 days ago",
      "description": "Support operations team with data entry, scheduling, and stakeholder communication. Experience with GCMS or similar government systems preferred. Bilingualism strongly preferred.",
      "apply_url": "https://fixture.example.com/jobs/admin-3"
    }
  ],
  "retail": [
    {
      "title": "Apple Specialist",
      "company": "Apple Retail",
      "location": "Ottawa, ON (Rideau Centre)",
      "date_posted": "1 day ago",
      "description": "Help customers explore and buy Apple products. Passion for technology and customer education. No prior Apple experience required — training provided. Full-time and part-time available. Competitive benefits.",
      "apply_url": "https://fixture.example.com/jobs/retail-1"
    },
    {
      "title": "Mobile Advisor",
      "company": "Bell Canada",
      "location": "Ottawa, ON",
      "date_posted": "4 days ago",
      "description": "Sell mobile devices and wireless plans. Meet monthly sales targets. Strong knowledge of Android and iOS ecosystem. Prior wireless retail experience preferred.",
      "apply_url": "https://fixture.example.com/jobs/retail-2"
    },
    {
      "title": "Consumer Electronics Specialist",
      "company": "London Drugs",
      "location": "Ottawa, ON",
      "date_posted": "6 days ago",
      "description": "Assist customers with electronics purchases. Demonstrate TVs, laptops, cameras, and smart home devices. Meet sales targets. Previous retail or electronics experience required.",
      "apply_url": "https://fixture.example.com/jobs/retail-3"
    }
  ]
}
```

- [ ] **Step 4: Create `server/scraper/index.js`**

```js
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
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npm test -- tests/scraper.test.js
```

Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add server/scraper/index.js server/scraper/fixtures.json tests/scraper.test.js
git commit -m "feat: scraper module with dry-run fixtures"
```

---

### Task 8: Analyzer Module (Gemini)

**Files:**
- Create: `server/analyzer/index.js`
- Create: `server/analyzer/gemini.js`
- Create: `tests/analyzer.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/analyzer.test.js

// Mock the Gemini SDK before requiring the analyzer
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            match_score: 85,
            match_tier: 'Strong Match',
            strengths: ['IT support experience', 'PGWP authorization'],
            gaps: ['No CCNA certification'],
            key_requirements: ['Tier 1/2 support', 'Windows AD'],
            apply_recommendation: true,
            one_line_pitch: 'My hands-on IT support background makes me a strong fit.'
          })
        }
      })
    })
  }))
}));

const { analyze } = require('../server/analyzer');

describe('Analyzer', () => {
  it('returns structured analysis object', async () => {
    const result = await analyze('resume text here', 'job description here');
    expect(result).toHaveProperty('match_score');
    expect(result).toHaveProperty('match_tier');
    expect(result).toHaveProperty('strengths');
    expect(result).toHaveProperty('gaps');
    expect(result).toHaveProperty('key_requirements');
    expect(result).toHaveProperty('apply_recommendation');
    expect(result).toHaveProperty('one_line_pitch');
  });

  it('match_score is a number between 0 and 100', async () => {
    const result = await analyze('resume', 'job');
    expect(typeof result.match_score).toBe('number');
    expect(result.match_score).toBeGreaterThanOrEqual(0);
    expect(result.match_score).toBeLessThanOrEqual(100);
  });

  it('match_tier is a valid tier string', async () => {
    const result = await analyze('resume', 'job');
    expect(['Strong Match', 'Good Match', 'Stretch', 'Skip']).toContain(result.match_tier);
  });

  it('strengths and gaps are arrays', async () => {
    const result = await analyze('resume', 'job');
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.gaps)).toBe(true);
    expect(Array.isArray(result.key_requirements)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/analyzer.test.js
```

Expected: FAIL — "Cannot find module '../server/analyzer'"

- [ ] **Step 3: Create `server/analyzer/index.js`**

```js
const provider = process.env.AI_PROVIDER || 'gemini';
module.exports = require(`./${provider}`);
```

- [ ] **Step 4: Create `server/analyzer/gemini.js`**

```js
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const RATE_LIMIT_DELAY_MS = 500;

async function analyze(resumeText, jobDescription) {
  const prompt = `You are a job application assistant evaluating candidate fit.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Analyze how well this candidate matches this job. Return ONLY valid JSON with this exact structure — no markdown, no explanation, no code fences:
{
  "match_score": <integer 0-100>,
  "match_tier": "<Strong Match|Good Match|Stretch|Skip>",
  "strengths": ["<strength1>", "<strength2>"],
  "gaps": ["<gap1>", "<gap2>"],
  "key_requirements": ["<req1>", "<req2>", "<req3>"],
  "apply_recommendation": <true|false>,
  "one_line_pitch": "<personalized cover letter opener>"
}

Scoring: Strong Match = 80-100, Good Match = 60-79, Stretch = 40-59, Skip = 0-39`;

  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip markdown code fences if model wraps response
  const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  return JSON.parse(jsonStr);
}

module.exports = { analyze };
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npm test -- tests/analyzer.test.js
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add server/analyzer/index.js server/analyzer/gemini.js tests/analyzer.test.js
git commit -m "feat: Gemini analyzer module"
```

---

### Task 9: Resume Loader

**Files:**
- Create: `server/resumes.js`

- [ ] **Step 1: Create `server/resumes.js`**

```js
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const tracks = require('../config/tracks');

const cache = {};

async function loadResumes() {
  for (const track of tracks) {
    const resumePath = path.resolve(track.resume);
    if (!fs.existsSync(resumePath)) {
      console.warn(`[resumes] Warning: missing resume for "${track.id}" at ${resumePath}`);
      console.warn(`[resumes] AI analysis will be skipped for this track until the file is added.`);
      continue;
    }
    try {
      const buffer = fs.readFileSync(resumePath);
      const data = await pdfParse(buffer);
      cache[track.id] = data.text;
      console.log(`[resumes] Loaded "${track.id}" resume — ${data.text.length} characters`);
    } catch (err) {
      console.warn(`[resumes] Failed to parse "${track.id}" resume: ${err.message}`);
    }
  }
}

function getResumeText(trackId) {
  return cache[trackId] || null;
}

module.exports = { loadResumes, getResumeText };
```

- [ ] **Step 2: Wire `loadResumes` into server startup in `server/app.js`**

Replace `server/app.js` with:

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');
const { loadResumes } = require('./resumes');

const app = express();
app.use(cors());
app.use(express.json());

getDb();

if (process.env.NODE_ENV !== 'test') {
  loadResumes().catch(err => console.error('[resumes] Load error:', err.message));
}

app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/scrape', require('./routes/scrape'));

module.exports = app;
```

- [ ] **Step 3: Verify startup still works**

```bash
node server/index.js
```

Expected: warnings about missing resume PDFs (normal — you haven't added them yet), then `HireTrack API running on :3001`. Ctrl+C to stop.

- [ ] **Step 4: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: all previous tests still pass

- [ ] **Step 5: Commit**

```bash
git add server/resumes.js server/app.js
git commit -m "feat: PDF resume loader with startup cache"
```

---

### Task 10: Scrape Routes + Async Job Runner

**Files:**
- Modify: `server/routes/scrape.js`
- Create: `tests/routes/scrape.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/routes/scrape.test.js

jest.mock('../../server/analyzer', () => ({
  analyze: jest.fn().mockResolvedValue({
    match_score: 80,
    match_tier: 'Strong Match',
    strengths: ['test strength'],
    gaps: [],
    key_requirements: ['support'],
    apply_recommendation: true,
    one_line_pitch: 'Test pitch line.'
  })
}));

jest.mock('../../server/resumes', () => ({
  loadResumes: jest.fn().mockResolvedValue(undefined),
  getResumeText: jest.fn().mockReturnValue('mock resume text')
}));

const request = require('supertest');
const app = require('../../server/app');
const { getDb } = require('../../server/db');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM jobs').run();
  db.prepare('DELETE FROM scrape_runs').run();
});

describe('POST /api/scrape/:track', () => {
  it('returns run_id immediately', async () => {
    const res = await request(app).post('/api/scrape/it-support');
    expect(res.status).toBe(200);
    expect(typeof res.body.run_id).toBe('number');
  });

  it('returns same run_id if a run is already in progress', async () => {
    const res1 = await request(app).post('/api/scrape/it-support');
    // Immediately fire another — may still be 'running'
    const res2 = await request(app).post('/api/scrape/it-support');
    expect(typeof res2.body.run_id).toBe('number');
  });

  it('inserts jobs into the database after run completes', async () => {
    await request(app).post('/api/scrape/it-support');
    await wait(3000); // wait for async job to finish
    const db = getDb();
    const jobs = db.prepare("SELECT * FROM jobs WHERE track = 'it-support'").all();
    expect(jobs.length).toBeGreaterThan(0);
  });
});

describe('GET /api/scrape/status/:track', () => {
  it('returns { status: "idle" } when no runs exist', async () => {
    const res = await request(app).get('/api/scrape/status/admin');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('idle');
  });

  it('returns run status after a scrape is triggered', async () => {
    await request(app).post('/api/scrape/it-support');
    const res = await request(app).get('/api/scrape/status/it-support');
    expect(res.status).toBe(200);
    expect(['running', 'done', 'error']).toContain(res.body.status);
  });

  it('run shows done and job counts after completion', async () => {
    await request(app).post('/api/scrape/it-support');
    await wait(3000);
    const res = await request(app).get('/api/scrape/status/it-support');
    expect(res.body.status).toBe('done');
    expect(res.body.jobs_found).toBeGreaterThan(0);
    expect(res.body.jobs_new).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- tests/routes/scrape.test.js
```

Expected: FAIL — routes exist but return nothing useful yet

- [ ] **Step 3: Implement `server/routes/scrape.js`**

```js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { scrape } = require('../scraper');
const { analyze } = require('../analyzer');
const { getResumeText } = require('../resumes');

router.post('/:track', (req, res) => {
  const db = getDb();
  const { track } = req.params;

  const existing = db
    .prepare("SELECT id FROM scrape_runs WHERE track = ? AND status = 'running'")
    .get(track);

  if (existing) {
    return res.json({ run_id: existing.id });
  }

  const { lastInsertRowid: runId } = db
    .prepare("INSERT INTO scrape_runs (track, status) VALUES (?, 'running')")
    .run(track);

  runScrapeJob(db, track, runId).catch(err => {
    db.prepare(
      "UPDATE scrape_runs SET status = 'error', error_msg = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(err.message, runId);
  });

  res.json({ run_id: runId });
});

async function runScrapeJob(db, trackId, runId) {
  const updateRun = db.prepare(
    'UPDATE scrape_runs SET jobs_found = ?, jobs_new = ?, jobs_analyzed = ? WHERE id = ?'
  );

  let jobsFound = 0;
  let jobsNew = 0;
  let jobsAnalyzed = 0;
  const newJobs = [];

  const rawJobs = await scrape(trackId);

  for (const job of rawJobs) {
    jobsFound++;
    try {
      const { lastInsertRowid: newId } = db.prepare(`
        INSERT INTO jobs (track, title, company, location, date_posted, description, apply_url, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        trackId, job.title, job.company,
        job.location || null, job.date_posted || null,
        job.description || null, job.apply_url,
        job.source || 'indeed'
      );
      jobsNew++;
      newJobs.push({ ...job, db_id: newId });
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) throw err;
      // Duplicate — skip
    }
    updateRun.run(jobsFound, jobsNew, jobsAnalyzed, runId);
  }

  const resumeText = getResumeText(trackId);

  for (const job of newJobs) {
    if (resumeText && job.description) {
      const result = await analyze(resumeText, job.description);
      db.prepare(`
        UPDATE jobs SET
          match_score = ?, match_tier = ?,
          strengths = ?, gaps = ?, key_requirements = ?,
          apply_recommendation = ?, one_line_pitch = ?,
          analyzed_at = datetime('now')
        WHERE apply_url = ?
      `).run(
        result.match_score, result.match_tier,
        JSON.stringify(result.strengths),
        JSON.stringify(result.gaps),
        JSON.stringify(result.key_requirements),
        result.apply_recommendation ? 1 : 0,
        result.one_line_pitch,
        job.apply_url
      );
    }
    jobsAnalyzed++;
    updateRun.run(jobsFound, jobsNew, jobsAnalyzed, runId);
  }

  db.prepare(
    "UPDATE scrape_runs SET status = 'done', finished_at = datetime('now') WHERE id = ?"
  ).run(runId);
}

router.get('/status/:track', (req, res) => {
  const db = getDb();
  const { track } = req.params;

  const run = db
    .prepare('SELECT * FROM scrape_runs WHERE track = ? ORDER BY id DESC LIMIT 1')
    .get(track);

  if (!run) return res.json({ status: 'idle' });

  res.json(run);
});

module.exports = router;
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- tests/routes/scrape.test.js
```

Expected: PASS — 6 tests (takes ~6s due to async wait)

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add server/routes/scrape.js tests/routes/scrape.test.js
git commit -m "feat: scrape routes with async job runner"
```

---

### Task 11: Indeed Scraper (Playwright)

**Files:**
- Create: `server/scraper/indeed.js`

No automated test — requires live browser. Manual testing instructions provided.

- [ ] **Step 1: Create `server/scraper/indeed.js`**

```js
const { chromium } = require('playwright');

const DELAY = () => 2000 + Math.random() * 2000; // 2–4s

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
```

> **Note:** Indeed's HTML structure changes periodically. If this scraper returns 0 jobs, open `https://ca.indeed.com/jobs?q=IT+Support+Ottawa` in a browser, inspect the job card elements, and update the selectors above. The logic stays the same — only selector strings need updating.

- [ ] **Step 2: Manual test with DRY_RUN=false**

Create a `.env` file:
```
GEMINI_API_KEY=your_key
AI_PROVIDER=gemini
SCRAPER_SOURCE=indeed
PORT=3001
DRY_RUN=false
```

Start the server and trigger a scrape:
```bash
node server/index.js &
curl -X POST http://localhost:3001/api/scrape/it-support
# Returns: {"run_id":1}
curl http://localhost:3001/api/scrape/status/it-support
# Poll until status is "done" — then:
curl http://localhost:3001/api/jobs?track=it-support
# Should return jobs with titles, companies, locations
```

Expected: at least a few jobs returned with title/company populated. If `jobs_found` is 0, Indeed's selectors need updating (see note above).

- [ ] **Step 3: Commit**

```bash
git add server/scraper/indeed.js
git commit -m "feat: Indeed.ca Playwright scraper"
```

---

### Task 12: React Client Scaffold

**Files:**
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/index.html`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/src/main.jsx`
- Create: `client/src/index.css`
- Create: `client/src/App.jsx`

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "hire-track-client",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.11"
  }
}
```

- [ ] **Step 2: Create `client/vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
```

- [ ] **Step 3: Create `client/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HireTrack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `client/tailwind.config.js`**

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: []
};
```

- [ ] **Step 5: Create `client/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 6: Create `client/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create `client/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Create `client/src/App.jsx` (skeleton)**

```jsx
import { useState, useEffect } from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">HireTrack</h1>
      </header>
      <main className="px-6 py-6">
        <p className="text-gray-400">Loading...</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Install client dependencies**

```bash
cd client && npm install
```

- [ ] **Step 10: Verify client starts**

```bash
cd client && npm run dev
```

Open `http://localhost:5173` — expect dark page with "HireTrack" header and "Loading..." text.

- [ ] **Step 11: Commit**

```bash
git add client/
git commit -m "feat: React client scaffold with Vite and Tailwind"
```

---

### Task 13: TrackTabs Component

**Files:**
- Modify: `client/src/App.jsx`
- Create: `client/src/components/TrackTabs.jsx`

- [ ] **Step 1: Create `client/src/components/TrackTabs.jsx`**

```jsx
export default function TrackTabs({ tracks, activeTrack, onSelect, onRefresh, isRefreshing }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-800 px-6">
      {tracks.map(track => (
        <button
          key={track.id}
          onClick={() => onSelect(track.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTrack === track.id
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>{track.emoji}</span>
          <span>{track.label}</span>
        </button>
      ))}
      <div className="ml-auto">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
          <span>{isRefreshing ? 'Scraping...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `client/src/App.jsx` to fetch tracks and render tabs**

```jsx
import { useState, useEffect } from 'react';
import TrackTabs from './components/TrackTabs';

export default function App() {
  const [tracks, setTracks] = useState([]);
  const [activeTrack, setActiveTrack] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [filters, setFilters] = useState({ tier: '', status: '' });

  useEffect(() => {
    fetch('/api/tracks')
      .then(r => r.json())
      .then(data => {
        setTracks(data);
        if (data.length > 0) setActiveTrack(data[0].id);
      })
      .catch(err => console.error('Failed to load tracks:', err));
  }, []);

  useEffect(() => {
    if (!activeTrack) return;
    const params = new URLSearchParams({ track: activeTrack });
    if (filters.tier)   params.set('tier', filters.tier);
    if (filters.status) params.set('status', filters.status);
    fetch(`/api/jobs?${params}`)
      .then(r => r.json())
      .then(setJobs)
      .catch(err => console.error('Failed to load jobs:', err));
  }, [activeTrack, filters]);

  function handleRefresh() {
    if (!activeTrack || isRefreshing) return;
    setIsRefreshing(true);
    fetch(`/api/scrape/${activeTrack}`, { method: 'POST' })
      .then(r => r.json())
      .then(() => {
        // ScrapeProgress component will poll and call onComplete
      })
      .catch(err => {
        console.error('Scrape failed:', err);
        setIsRefreshing(false);
      });
  }

  function handleScrapeComplete() {
    setIsRefreshing(false);
    // Reload jobs after scrape finishes
    const params = new URLSearchParams({ track: activeTrack });
    fetch(`/api/jobs?${params}`)
      .then(r => r.json())
      .then(setJobs);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">HireTrack</h1>
      </header>

      {tracks.length > 0 && (
        <TrackTabs
          tracks={tracks}
          activeTrack={activeTrack}
          onSelect={id => { setActiveTrack(id); setSelectedJob(null); }}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      <main className="px-6 py-4">
        <p className="text-gray-500 text-sm">{jobs.length} jobs loaded for {activeTrack}</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Manual test**

Start both server and client:
```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
- Three tabs appear: 🖥️ IT Support, 📋 Admin, 🍎 Retail+
- Active tab has blue underline
- Clicking tabs switches `activeTrack` (check console or update the `<p>` text)
- Refresh button appears on the right

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx client/src/components/TrackTabs.jsx
git commit -m "feat: TrackTabs component with API-driven tabs"
```

---

### Task 14: JobList and JobCard Components

**Files:**
- Create: `client/src/components/JobList.jsx`
- Create: `client/src/components/JobCard.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Create `client/src/components/JobCard.jsx`**

```jsx
const TIER_STYLES = {
  'Strong Match': { badge: 'bg-green-900 text-green-300', border: 'border-l-green-500', score: 'bg-green-500 text-gray-950' },
  'Good Match':   { badge: 'bg-blue-900 text-blue-300',   border: 'border-l-blue-500',  score: 'bg-blue-500 text-gray-950' },
  'Stretch':      { badge: 'bg-yellow-900 text-yellow-300', border: 'border-l-yellow-500', score: 'bg-yellow-400 text-gray-950' },
  'Skip':         { badge: 'bg-gray-800 text-gray-400',   border: 'border-l-gray-600',  score: 'bg-gray-600 text-gray-200' },
};

const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

export default function JobCard({ job, isSelected, onSelect, onStatusChange }) {
  const tier = TIER_STYLES[job.match_tier] || TIER_STYLES['Skip'];

  function handleStatusChange(e) {
    e.stopPropagation();
    onStatusChange(job.id, e.target.value);
  }

  return (
    <div
      onClick={() => onSelect(job)}
      className={`flex items-center gap-4 px-4 py-3 rounded-lg border-l-4 cursor-pointer transition-colors ${tier.border} ${
        isSelected ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{job.title}</p>
        <p className="text-gray-400 text-xs mt-0.5">
          {job.company} · {job.location} · {job.date_posted}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {job.match_tier && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tier.badge}`}>
            {job.match_tier}
          </span>
        )}

        {job.match_score != null ? (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${tier.score}`}>
            {job.match_score}
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs text-gray-600 border border-gray-700">
            —
          </div>
        )}

        <select
          value={job.status}
          onChange={handleStatusChange}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `client/src/components/JobList.jsx`**

```jsx
import JobCard from './JobCard';

export default function JobList({ jobs, selectedJob, onSelect, onStatusChange }) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-600">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm">No jobs yet. Hit Refresh to scrape.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {jobs.map(job => (
        <JobCard
          key={job.id}
          job={job}
          isSelected={selectedJob?.id === job.id}
          onSelect={onSelect}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update `client/src/App.jsx` to render JobList and handle status updates**

Replace the `<main>` section and add `handleStatusChange`:

```jsx
import { useState, useEffect } from 'react';
import TrackTabs from './components/TrackTabs';
import JobList from './components/JobList';

export default function App() {
  const [tracks, setTracks] = useState([]);
  const [activeTrack, setActiveTrack] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [filters, setFilters] = useState({ tier: '', status: '' });

  useEffect(() => {
    fetch('/api/tracks')
      .then(r => r.json())
      .then(data => {
        setTracks(data);
        if (data.length > 0) setActiveTrack(data[0].id);
      });
  }, []);

  function loadJobs(trackId, currentFilters) {
    const params = new URLSearchParams({ track: trackId });
    if (currentFilters.tier)   params.set('tier', currentFilters.tier);
    if (currentFilters.status) params.set('status', currentFilters.status);
    fetch(`/api/jobs?${params}`)
      .then(r => r.json())
      .then(setJobs);
  }

  useEffect(() => {
    if (activeTrack) loadJobs(activeTrack, filters);
  }, [activeTrack, filters]);

  function handleRefresh() {
    if (!activeTrack || isRefreshing) return;
    setIsRefreshing(true);
    fetch(`/api/scrape/${activeTrack}`, { method: 'POST' }).catch(() => setIsRefreshing(false));
  }

  function handleScrapeComplete() {
    setIsRefreshing(false);
    loadJobs(activeTrack, filters);
  }

  function handleStatusChange(jobId, newStatus) {
    fetch(`/api/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
      .then(r => r.json())
      .then(updated => {
        setJobs(prev => prev.map(j => j.id === updated.id ? { ...j, status: updated.status } : j));
      });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold tracking-tight">HireTrack</h1>
      </header>

      {tracks.length > 0 && (
        <TrackTabs
          tracks={tracks}
          activeTrack={activeTrack}
          onSelect={id => { setActiveTrack(id); setSelectedJob(null); }}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      <main className="flex-1 px-6 py-4 overflow-auto">
        <JobList
          jobs={jobs}
          selectedJob={selectedJob}
          onSelect={setSelectedJob}
          onStatusChange={handleStatusChange}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Manual test**

With `DRY_RUN=true` in `.env`, start both servers (`npm run dev`). Run a dry-run scrape:

```bash
curl -X POST http://localhost:3001/api/scrape/it-support
```

Reload `http://localhost:5173` — job cards should appear, sorted by score, with tier badges and status dropdowns. Changing a status dropdown should persist (verify via network tab or page reload).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/JobCard.jsx client/src/components/JobList.jsx client/src/App.jsx
git commit -m "feat: JobList and JobCard components with status updates"
```

---

### Task 15: ScrapeProgress Component

**Files:**
- Create: `client/src/components/ScrapeProgress.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Create `client/src/components/ScrapeProgress.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';

export default function ScrapeProgress({ trackId, isActive, onComplete }) {
  const [stats, setStats] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isActive || !trackId) {
      setStats(null);
      return;
    }

    intervalRef.current = setInterval(() => {
      fetch(`/api/scrape/status/${trackId}`)
        .then(r => r.json())
        .then(data => {
          setStats(data);
          if (data.status === 'done' || data.status === 'error') {
            clearInterval(intervalRef.current);
            onComplete(data);
          }
        })
        .catch(() => {
          clearInterval(intervalRef.current);
          onComplete({ status: 'error' });
        });
    }, 2000);

    return () => clearInterval(intervalRef.current);
  }, [isActive, trackId]);

  if (!isActive) return null;

  return (
    <div className="mx-6 mt-3 bg-gray-800 rounded-lg px-4 py-3">
      <div className="flex justify-between items-center mb-2 text-sm">
        <span className="text-blue-400 font-medium">
          ↻ Scraping {trackId}...
        </span>
        {stats && (
          <span className="text-gray-400 text-xs">
            {stats.jobs_found ?? 0} found · {stats.jobs_new ?? 0} new · {stats.jobs_analyzed ?? 0} analyzed
          </span>
        )}
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: '40%' }} />
      </div>
      {stats?.status === 'error' && (
        <p className="text-red-400 text-xs mt-2">{stats.error_msg || 'Scrape failed'}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add ScrapeProgress to `client/src/App.jsx`**

Add import at top:
```jsx
import ScrapeProgress from './components/ScrapeProgress';
```

Add `<ScrapeProgress>` after `<TrackTabs>` and before `<main>`:
```jsx
<ScrapeProgress
  trackId={activeTrack}
  isActive={isRefreshing}
  onComplete={handleScrapeComplete}
/>
```

- [ ] **Step 3: Manual test**

With `DRY_RUN=true`, click the Refresh button on any track. Verify:
- Progress bar appears below the tabs
- Stats update every 2 seconds (found/new/analyzed counts)
- Progress bar disappears and job list refreshes when scrape completes

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ScrapeProgress.jsx client/src/App.jsx
git commit -m "feat: ScrapeProgress component with 2s polling"
```

---

### Task 16: JobDetail Panel

**Files:**
- Create: `client/src/components/JobDetail.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Create `client/src/components/JobDetail.jsx`**

```jsx
export default function JobDetail({ job, onClose }) {
  if (!job) return null;

  return (
    <div className="w-96 shrink-0 border-l border-gray-800 bg-gray-900 overflow-y-auto flex flex-col">
      <div className="flex items-start justify-between p-4 border-b border-gray-800">
        <div>
          <h2 className="font-semibold text-sm">{job.title}</h2>
          <p className="text-gray-400 text-xs mt-0.5">{job.company} · {job.location}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none ml-2"
        >
          ×
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 text-sm">
        {job.one_line_pitch && (
          <div className="bg-gray-800 rounded-lg p-3 border-l-2 border-blue-500">
            <p className="text-gray-300 italic text-xs leading-relaxed">{job.one_line_pitch}</p>
          </div>
        )}

        {job.strengths?.length > 0 && (
          <div>
            <h3 className="text-green-400 font-medium text-xs uppercase tracking-wide mb-2">
              ✓ Strengths
            </h3>
            <ul className="space-y-1">
              {job.strengths.map((s, i) => (
                <li key={i} className="text-gray-300 text-xs flex gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {job.gaps?.length > 0 && (
          <div>
            <h3 className="text-red-400 font-medium text-xs uppercase tracking-wide mb-2">
              ✗ Gaps
            </h3>
            <ul className="space-y-1">
              {job.gaps.map((g, i) => (
                <li key={i} className="text-gray-300 text-xs flex gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {job.key_requirements?.length > 0 && (
          <div>
            <h3 className="text-orange-400 font-medium text-xs uppercase tracking-wide mb-2">
              Key Requirements
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {job.key_requirements.map((r, i) => (
                <span
                  key={i}
                  className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {!job.match_score && (
          <p className="text-gray-600 text-xs italic">Analysis pending...</p>
        )}

        {job.apply_url && (
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto block text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Apply →
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `client/src/App.jsx` to show JobDetail in a side panel**

Add import at top:
```jsx
import JobDetail from './components/JobDetail';
```

Wrap `<main>` and add panel — replace the `<main>` + everything below with:
```jsx
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 px-6 py-4 overflow-auto">
          <JobList
            jobs={jobs}
            selectedJob={selectedJob}
            onSelect={setSelectedJob}
            onStatusChange={handleStatusChange}
          />
        </main>
        <JobDetail
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      </div>
    </div>
  );
```

- [ ] **Step 3: Manual test**

Open `http://localhost:5173`. Click any job card. Verify:
- Detail panel slides in on the right
- Pitch, strengths, gaps, key requirements appear (if job has been analyzed)
- "Apply →" button opens the apply URL in a new tab
- × button closes the panel

- [ ] **Step 4: Commit**

```bash
git add client/src/components/JobDetail.jsx client/src/App.jsx
git commit -m "feat: JobDetail side panel"
```

---

### Task 17: Filters

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Add filter dropdowns to the job list header in `client/src/App.jsx`**

Add a filter bar between the progress bar and `<main>`. Insert after `<ScrapeProgress .../>`:

```jsx
      <div className="flex items-center gap-3 px-6 py-2 border-b border-gray-800 bg-gray-950">
        <span className="text-gray-500 text-xs uppercase tracking-wide">Filter:</span>
        <select
          value={filters.tier}
          onChange={e => setFilters(f => ({ ...f, tier: e.target.value }))}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
        >
          <option value="">All Tiers</option>
          <option value="Strong Match">Strong Match</option>
          <option value="Good Match">Good Match</option>
          <option value="Stretch">Stretch</option>
          <option value="Skip">Skip</option>
        </select>
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="Saved">Saved</option>
          <option value="Applied">Applied</option>
          <option value="Interview">Interview</option>
          <option value="Offer">Offer</option>
          <option value="Rejected">Rejected</option>
        </select>
        {(filters.tier || filters.status) && (
          <button
            onClick={() => setFilters({ tier: '', status: '' })}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-600">{jobs.length} jobs</span>
      </div>
```

- [ ] **Step 2: Reset filters when switching tracks**

In the `onSelect` handler inside `<TrackTabs>`, also reset filters:
```jsx
onSelect={id => { setActiveTrack(id); setSelectedJob(null); setFilters({ tier: '', status: '' }); }}
```

- [ ] **Step 3: Manual test**

With jobs in the database:
- Filter by "Strong Match" — only green-bordered cards visible
- Filter by "Applied" — only applied jobs visible
- Switch tracks — filters reset to "All"
- "Clear" button resets both filters
- Job count in top right updates as filters change

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: per-tab filter dropdowns for tier and status"
```

---

### Task 18: Final Polish and End-to-End Verification

**Files:**
- Modify: `.gitignore`
- Create: `resumes/` directory placeholder

- [ ] **Step 1: Update `.gitignore` to ensure no sensitive files slip in**

```
node_modules/
client/node_modules/
.env
data/
resumes/
.superpowers/
*.db
```

- [ ] **Step 2: Create a `resumes/.gitkeep` so the directory exists in git**

```bash
mkdir resumes
echo "" > resumes/.gitkeep
```

- [ ] **Step 3: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Full dry-run end-to-end test**

Ensure `.env` has `DRY_RUN=true`. Start both processes:
```bash
npm run dev
```

In a separate terminal:
```bash
# Scrape all three tracks
curl -X POST http://localhost:3001/api/scrape/it-support
curl -X POST http://localhost:3001/api/scrape/admin
curl -X POST http://localhost:3001/api/scrape/retail

# Wait ~5 seconds, then check jobs exist
curl http://localhost:3001/api/jobs | python -m json.tool | head -60
```

In the browser at `http://localhost:5173`:
- [ ] All three track tabs are visible
- [ ] Jobs appear in each tab sorted by score
- [ ] Score circles and tier badges render with correct colors
- [ ] Click a job card → detail panel opens with pitch, strengths, gaps
- [ ] Status dropdown updates persist on page reload
- [ ] Tier and status filters work per-tab
- [ ] Refresh button triggers scrape + progress bar appears + jobs reload on complete

- [ ] **Step 5: Drop a real resume PDF and test analysis**

Copy a resume PDF to `resumes/it-support.pdf`. In `.env` set `DRY_RUN=false` and add your real `GEMINI_API_KEY`. Restart the server:

```bash
node server/index.js
```

Expected on startup: `[resumes] Loaded "it-support" resume — XXXX characters`

Trigger a real scrape (make sure you have patience — Indeed scraping takes ~2 min per track):
```bash
curl -X POST http://localhost:3001/api/scrape/it-support
```

Poll status until done:
```bash
curl http://localhost:3001/api/scrape/status/it-support
```

Check jobs have AI scores:
```bash
curl "http://localhost:3001/api/jobs?track=it-support" | python -m json.tool | grep match_score
```

- [ ] **Step 6: Final commit**

```bash
git add .gitignore resumes/.gitkeep
git commit -m "feat: final polish and end-to-end verified"
```
