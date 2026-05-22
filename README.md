# HireTrack

A self-hosted LinkedIn job scraper and AI-powered job matching tool. HireTrack scrapes LinkedIn job listings, filters them by configurable rules, and uses an AI model (DeepSeek or Gemini) to score each job against your resume — so you spend time only on roles worth applying to.

## Features

- Scrapes LinkedIn job listings for one or more search tracks
- Filters jobs by title allowlist and description blockers (clearance requirements, language requirements, experience thresholds, etc.)
- Analyzes each job against your resume using DeepSeek or Gemini AI
- Scores jobs as Strong Match / Good Match / Stretch with strengths, gaps, and a one-line pitch
- Tracks application status (Saved, Applied, Interview, Offer, Rejected, Not Interested)
- Sidebar filters by match tier, status, and date posted
- Pause / Resume / Stop analysis mid-run
- Deduplicates jobs across search queries

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node.js)
- A [DeepSeek API key](https://platform.deepseek.com/) or [Google Gemini API key](https://aistudio.google.com/app/apikey)
- Playwright Chromium (installed automatically via `npx playwright install chromium`)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/hire-track.git
cd hire-track
```

### 2. Install dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 3. Install Playwright browser

```bash
npx playwright install chromium
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values (see [Environment Variables](#environment-variables) below).

### 5. Add your resume PDFs

Each track defined in `config/tracks.js` has a `resume` path. Place your resume PDF at the path specified for each track. By default:

```
resumes/
  it-support.pdf
  admin.pdf
```

Create the `resumes/` directory and add your PDFs:

```bash
mkdir resumes
cp /path/to/your-resume.pdf resumes/it-support.pdf
```

If a resume is missing, the server will start but AI analysis will be skipped for that track until the file is added.

---

## Running the App

### Option A — run server and client separately (recommended for development)

**Terminal 1 — API server:**
```bash
node server/index.js
```

**Terminal 2 — frontend dev server:**
```bash
cd client
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Option B — run both with one command

```bash
npm run dev
```

---

## How to Use

1. **Select a track** from the tabs at the top (each track has its own search queries and resume).
2. **Click Refresh** to scrape LinkedIn for new jobs matching the track's queries. New jobs are saved to the database and automatically analyzed against your resume.
3. **Click Analyze** to (re-)analyze any jobs that don't yet have a match score — useful if you added a resume after scraping, or hit an API quota during a previous run.
4. **Filter the job list** using the sidebar:
   - **Match level** — Strong Match, Good Match, Stretch
   - **Status** — Saved, Applied, Interview, Offer, Rejected, Not Interested
   - **Posted** — Last 24 hours, 3 days, 7 days, 30 days
5. **Click a job** to open the detail panel with the full AI analysis: score, strengths, gaps, key requirements, and a suggested cover letter opener.
6. **Set a status** on any job using the dropdown in the detail panel.

> Applied and Not Interested jobs are hidden from the main list by default. Click their sidebar filters to see them.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | No | `gemini` | AI backend to use: `deepseek`, `gemini`, or `zhipu` |
| `DEEPSEEK_API_KEY` | If using DeepSeek | — | Your DeepSeek API key |
| `DEEPSEEK_MODEL` | No | `deepseek-v4-flash` | DeepSeek model name |
| `GEMINI_API_KEY` | If using Gemini | — | Your Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model name |
| `PORT` | No | `3001` | Port for the API server |
| `DRY_RUN` | No | `false` | Set to `true` to skip real AI calls and return mock scores (useful for testing) |

---

## Track Configuration

Tracks are defined in `config/tracks.js`. Each track has a unique ID, a display label, a resume PDF path, and a list of LinkedIn search queries.

```js
module.exports = [
  {
    id: 'it-support',
    label: 'IT Support',
    resume: './resumes/it-support.pdf',
    queries: [
      'IT Support Specialist',
      'Help Desk Analyst',
      'Desktop Support Technician',
      // add more queries here
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    resume: './resumes/admin.pdf',
    queries: [
      'Administrative Assistant',
      'Office Coordinator',
    ],
  },
];
```

To add a new track:
1. Add an entry to `config/tracks.js`
2. Place the corresponding resume PDF at the path you specified
3. Restart the server

---

## How Filtering Works

HireTrack filters jobs in the scraper before they are saved to the database, so junk never reaches your list.

### Title filtering

Each track applies its own title filter:

- **IT track** — uses a keyword allowlist (`support`, `network`, `technician`, `helpdesk`, `desktop`, `infrastructure`, `security`, `analyst`, `administrator`, `engineer`, `specialist`, `coordinator`, `technical`, `cyber`, `cloud`, `data`, `software`, `developer`, `database`, `IT`). Jobs with no matching keyword are rejected. A secondary domain-blocker list vetoes false positives (e.g. `mechanical engineer`, `marketing`, `recruiter`).
- **Admin track** — uses a strict role allowlist: administrative assistant, office coordinator, operations coordinator, office administrator, executive assistant, program/project coordinator, office manager, receptionist, administrative coordinator. Any title not matching this list is rejected.
- **All tracks** — A built-in French-language title detector and a `bilingual` title check are included as examples. Remove or replace these if they don't apply to your situation.

### Description filtering

A set of phrase blockers is checked against the job's description snippet. Any match rejects the job entirely.

> **The default blockers in `server/scraper/linkedin.js` are examples — edit them to match your own constraints** (location, language requirements, clearance eligibility, experience level, domain exclusions, etc.). What's irrelevant for one person's job search may be perfectly fine for another's.

The file ships with example blockers for things like clearance requirements, residency requirements, language requirements, driver's licence requirements, experience thresholds, and domain-specific keywords. A compound check (two phrases both present in the description) and a French-language description detector are also included as examples.

To customise:
- Edit `DESC_BLOCKERS` in `server/scraper/linkedin.js` to add or remove phrase blockers
- Adjust or remove the compound checks and language detector in `shouldFilter()` to suit your needs
- Restart the server after any changes

---

## Database

Jobs are stored in a SQLite database at `data/hiretrack.db`, created automatically on first run. No database setup is required.

---

## License

MIT
