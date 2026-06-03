# HireTrack

An automated job scraping and AI analysis radar for local job searches. HireTrack scrapes LinkedIn for relevant postings, filters noise before saving, and runs an AI model against your resume to score and rank every job — so you focus on applying, not hunting.

## Core Features

- **Multi-track workspace** — maintain separate job pipelines (IT Support, Admin, Software Dev, etc.), each with its own resume, strategy settings, and scraped job list
- **Global vs. track-specific strategy** — visa status, languages, and mobility are set once globally; target roles, experience level, employment type, and blacklisted keywords are configured per track
- **Pre-scrape LLM query expansion** — for tracks created via the UI, DeepSeek automatically generates 5–8 alternative job titles before Playwright runs, so "Sales Associate" doesn't just search that one phrase
- **Post-save AI analysis** — scores each job against your resume, produces a match tier (Strong Match / Good Match / Stretch / Skip), highlights strengths and gaps, and generates a one-line cover letter opener
- **Real-time progress** — scrape and analysis runs stream live job counts to the UI as they process
- **Application tracking** — mark jobs as Saved, Applied, Interview, Offer, Rejected, or Not Interested

---

## Prerequisites

- **Node.js** v18 or later and **npm**
- A **DeepSeek API key** (recommended) or **Google Gemini API key**
- Playwright Chromium browser — install it once after cloning:
  ```bash
  npx playwright install --with-deps chromium
  ```

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/cocoingenuity/hire-track.git
cd hire-track
```

### 2. Install dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 3. Environment variables

Create `server/.env`:

```env
# AI provider — "deepseek" (recommended) or "gemini"
AI_PROVIDER=deepseek

# DeepSeek
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash        # optional, this is the default

# Gemini (alternative)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash           # optional, this is the default

# Set to "true" to test with fixture data instead of live LinkedIn scraping
DRY_RUN=false
```

### 4. Add your resume PDFs

Place one PDF per built-in track in the `resumes/` folder at the project root:

```
resumes/
  it-support.pdf
  admin.pdf
```

If a resume is missing the server will start normally — AI analysis is simply skipped for that track until the file is added. Tracks you create via the UI accept resume uploads directly from the Strategy Settings page.

### 5. Database

No manual SQL setup required. The SQLite database (`data/hiretrack.db`) is created automatically on first run and migrated to the latest schema on every subsequent start.

---

## Running

Start both servers from the project root:

```bash
npm run dev
```

Or start them separately in two terminals:

```bash
# Terminal 1 — API server (http://localhost:3001)
npm run server

# Terminal 2 — frontend dev server (http://localhost:5173)
npm run client
```

Open **http://localhost:5173** in your browser.

---

## How to Use

1. **Select a track** from the tabs at the top.
2. **Click Refresh** to scrape LinkedIn for new jobs. For tracks created via the UI, the AI expander first generates search queries from your target roles.
3. **Select jobs** and click **Analyze** to score them against your resume.
4. **Filter the job list** using the sidebar — by match tier, status, or date posted.
5. **Click a job** to open the detail panel: score, strengths, gaps, key requirements, and a suggested cover letter opener.
6. **Strategy Settings** (top-right) — set your global candidate profile once, then configure per-track job preferences and upload a resume per track.

---

## Project Structure

```
hire-track/
├── client/          # React + Vite frontend
├── config/
│   └── tracks.js    # Built-in track definitions (curated scraper queries)
├── data/            # SQLite database (auto-created)
├── resumes/         # PDF resumes, one per track
└── server/
    ├── analyzer/    # AI scoring engine (DeepSeek / Gemini)
    ├── routes/      # Express API routes
    ├── scraper/     # Playwright LinkedIn scraper + LLM query expander
    ├── app.js
    └── index.js
```

---

## License

MIT
