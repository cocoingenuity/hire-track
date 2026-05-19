# HireTrack — Design Spec
**Date:** 2026-05-18
**Author:** Ningyi Wang

---

## Overview

HireTrack is a local web app for job hunting across multiple tracks simultaneously. It scrapes job postings from Indeed.ca, scores each posting against the relevant resume using Gemini AI, and tracks application status. The user applies manually — HireTrack never auto-submits anything.

---

## Goals & Non-Goals

**Goals:**
- Automatically discover new job postings per track on demand
- Score each job against the matching resume (0–100 + tier + strengths/gaps)
- Track application status from Saved → Applied → Interview → Offer/Rejected
- Support any number of job tracks without code changes

**Non-Goals:**
- Auto-applying or form-filling of any kind
- Scheduled/automated scraping (user-triggered only)
- Multi-user support
- Cloud deployment

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Frontend | React + Tailwind CSS + Vite |
| Database | SQLite via `better-sqlite3` |
| Scraping | Playwright (headless Chromium) |
| AI Analysis | Gemini API (`gemini-2.0-flash`) — swappable module |
| PDF Parsing | `pdf-parse` |
| Dev runner | `concurrently` |

---

## Architecture

Two processes in development:
- **Express API** on `:3001`
- **Vite dev server** on `:5173`, proxying `/api/*` to `:3001`

One `npm run dev` starts both via `concurrently`. In production, `npm run build` outputs a static React bundle served directly by Express.

Scraping and AI analysis run as async operations within the Express process. A `scrape_runs` table tracks progress; the frontend polls `/api/scrape/status/:track` every 2 seconds during an active scrape to update a progress bar.

---

## Project Structure

```
hire-track/
├── config/
│   └── tracks.js             # All track definitions — only file to edit for new tracks
├── server/
│   ├── index.js              # Express entry + startup (PDF loading, DB init)
│   ├── db.js                 # SQLite schema + migrations
│   ├── routes/
│   │   ├── jobs.js           # GET /api/jobs, PATCH /api/jobs/:id/status
│   │   ├── scrape.js         # POST /api/scrape/:track, GET /api/scrape/status/:track
│   │   └── tracks.js         # GET /api/tracks
│   ├── scraper/
│   │   ├── index.js          # Loads provider from SCRAPER_SOURCE env
│   │   ├── indeed.js         # Playwright scraper implementation
│   │   └── fixtures.json     # Fake jobs for dry-run mode (~10 per track)
│   └── analyzer/
│       ├── index.js          # Loads provider from AI_PROVIDER env
│       └── gemini.js         # Gemini 2.0 Flash implementation
├── client/
│   ├── package.json
│   ├── vite.config.js            # Proxies /api to :3001
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── components/
│           ├── TrackTabs.jsx     # Tab bar + per-track Refresh button
│           ├── JobList.jsx       # Filtered/sorted list for active track
│           ├── JobCard.jsx       # Compact row: title, company, score, tier, status dropdown
│           ├── JobDetail.jsx     # Expanded panel: strengths, gaps, pitch, apply link
│           └── ScrapeProgress.jsx # Progress bar shown during active scrape
├── resumes/                  # Drop PDFs here — gitignored
│   ├── it-support.pdf
│   ├── admin.pdf
│   └── retail.pdf
├── data/
│   └── hiretrack.db          # SQLite database — gitignored
├── .env                      # API keys — gitignored
├── .env.example
└── package.json              # Root — runs client + server
```

---

## Track Configuration

All track definitions live in `config/tracks.js`. Adding a new track requires only:
1. Adding an entry to this file
2. Dropping the resume PDF in `resumes/`

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
      'Office Coordinator Ottawa'
    ]
  },
  {
    id: 'retail',
    label: 'Retail+',
    emoji: '🍎',
    resume: './resumes/retail.pdf',
    queries: [
      'Apple Specialist Ottawa',
      'Mobile Advisor Ottawa'
    ]
  }
]
```

The frontend fetches `/api/tracks` at startup and renders tabs dynamically — no track names are hardcoded in React.

---

## Data Model

### `jobs` table

```sql
CREATE TABLE jobs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  track             TEXT NOT NULL,
  title             TEXT NOT NULL,
  company           TEXT NOT NULL,
  location          TEXT,
  date_posted       TEXT,
  description       TEXT,
  apply_url         TEXT UNIQUE,         -- deduplication key
  source            TEXT DEFAULT 'indeed',

  -- AI analysis (NULL until analyzed)
  match_score       INTEGER,
  match_tier        TEXT,                -- 'Strong Match' | 'Good Match' | 'Stretch' | 'Skip'
  strengths         TEXT,                -- JSON array
  gaps              TEXT,                -- JSON array
  key_requirements  TEXT,                -- JSON array
  apply_recommendation INTEGER,          -- 0 or 1
  one_line_pitch    TEXT,
  analyzed_at       TEXT,

  -- Application tracker
  status            TEXT DEFAULT 'Saved', -- 'Saved' | 'Applied' | 'Interview' | 'Offer' | 'Rejected'
  scraped_at        TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `scrape_runs` table

```sql
CREATE TABLE scrape_runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  track          TEXT NOT NULL,
  status         TEXT,                  -- 'running' | 'done' | 'error'
  jobs_found     INTEGER DEFAULT 0,
  jobs_new       INTEGER DEFAULT 0,
  jobs_analyzed  INTEGER DEFAULT 0,
  error_msg      TEXT,
  started_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  finished_at    TEXT
);
```

**Deduplication:** `apply_url` is the unique key. Re-scraping skips known jobs and preserves existing scores and status.

---

## API Routes

### Tracks
```
GET  /api/tracks
     → returns array of track objects from config/tracks.js
```

### Jobs
```
GET  /api/jobs?track=it-support&tier=Strong+Match&status=Saved
     → jobs sorted by match_score DESC; all params optional

PATCH /api/jobs/:id/status
     body: { status: "Applied" }
     → updates application status
```

### Scraping
```
POST /api/scrape/:track
     → starts async scrape + analyze for the given track
     → returns { run_id }
     → if a run is already in progress, returns the existing run_id

GET  /api/scrape/status/:track
     → returns latest scrape run: { status, jobs_found, jobs_new, jobs_analyzed, error_msg }
     → frontend polls every 2s during active scrape
```

---

## Scraper Module

`server/scraper/index.js` loads the active provider via `SCRAPER_SOURCE` env (`indeed` by default). Adding a new source means creating a new file with the same interface — no other changes.

`indeed.js` uses Playwright (headless Chromium):
- Runs all queries for the given track (from `config/tracks.js`)
- Up to 3 pages per query
- 2–4s random delay between requests
- Extracts: title, company, location, date posted, full description, apply URL

**Dry-run mode:** When `DRY_RUN=true`, the scraper returns fixture data from `fixtures.json` without launching Playwright. Used for testing.

---

## Analyzer Module

`server/analyzer/index.js` loads the active provider via `AI_PROVIDER` env (`gemini` by default). Swapping providers means adding a new file + changing the env var.

`gemini.js` calls `gemini-2.0-flash` with resume text + job description, requesting structured JSON:

```json
{
  "match_score": 87,
  "match_tier": "Strong Match",
  "strengths": ["customer-facing IT support", "PGWP — no sponsorship needed"],
  "gaps": ["no CCNA certification"],
  "key_requirements": ["Tier 1/2 support", "Windows/Active Directory"],
  "apply_recommendation": true,
  "one_line_pitch": "My hands-on IT support background at Best Buy..."
}
```

- Match tiers: **Strong Match** (80–100) · **Good Match** (60–79) · **Stretch** (40–59) · **Skip** (<40)
- 500ms delay between Gemini calls to respect the free-tier rate limit (15 RPM)
- Resume PDFs are parsed at server startup using `pdf-parse` and cached in memory

---

## Frontend

### Dashboard Layout
Tabs per track (rendered from `/api/tracks`). Each tab shows:
- A **Refresh** button that triggers `POST /api/scrape/:track`
- A **ScrapeProgress** bar (appears only during active scrape, polls every 2s)
- A **JobList** — job cards sorted by `match_score` DESC

### Job Card (compact row)
- Left: job title + company + location + date posted
- Right: tier badge (color-coded) + score circle + status dropdown

**Tier colors:**
| Tier | Color |
|---|---|
| Strong Match | Green |
| Good Match | Blue |
| Stretch | Yellow |
| Skip | Gray |

### Job Detail Panel
Clicking a card expands a detail panel showing:
- One-line pitch (italicized)
- Strengths list (green)
- Gaps list (red)
- Key requirements (tags)
- Apply button → opens `apply_url` in new tab

### Filters
Jobs can be filtered by tier and status via dropdowns in the tab header. Filters are per-tab (not global).

---

## Environment Config (`.env`)

```
GEMINI_API_KEY=your_key_here
AI_PROVIDER=gemini
SCRAPER_SOURCE=indeed
PORT=3001
DRY_RUN=false
```

Resume paths and search queries live in `config/tracks.js`, not `.env`.

---

## Error Handling

- Routes return `{ error: "message" }` with appropriate HTTP status codes
- The frontend shows a toast notification on any API error
- If Gemini returns malformed JSON, the scrape run is marked `error` with the message stored in `scrape_runs.error_msg`
- If a resume PDF is missing at startup, a warning is logged and analysis is skipped for that track (the app still starts)
- If Playwright times out or is blocked, the scrape run is marked `error`

---

## Explicit Non-Features

- **No auto-applying.** HireTrack finds and tracks only. The user applies manually.
- **No scheduled scraping.** All scrapes are user-triggered via the dashboard.
- **No LinkedIn scraping (yet).** Scraper is architected to support it; Indeed ships first.
- **No multi-user support.** Local tool only.
