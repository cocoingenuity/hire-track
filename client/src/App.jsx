import { useState, useEffect, useMemo } from 'react';
import JobList from './components/JobList';
import ScrapeProgress from './components/ScrapeProgress';
import JobDetail from './components/JobDetail';

const DAY_MS = 24 * 60 * 60 * 1000;

// Prefer date_posted (job listing date) over scraped_at for date filters.
// date_posted is YYYY-MM-DD (parse as UTC midnight); scraped_at is "YYYY-MM-DD HH:MM:SS" (UTC).
function jobDate(job) {
  if (job.date_posted) return new Date(job.date_posted + 'T00:00:00Z').getTime();
  if (job.scraped_at)  return new Date(job.scraped_at  + 'Z').getTime();
  return 0;
}

export default function App() {
  const [tracks, setTracks]           = useState([]);
  const [activeTrack, setActiveTrack] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMode, setRefreshMode] = useState('scrape');
  const [jobs, setJobs]               = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [filters, setFilters]         = useState({ tier: '', status: '', days: '' });
  const [sort, setSort]               = useState('score'); // 'score' | 'date'

  useEffect(() => {
    fetch('/api/tracks')
      .then(r => r.json())
      .then(data => { setTracks(data); if (data.length > 0) setActiveTrack(data[0].id); })
      .catch(err => console.error('Failed to load tracks:', err));
  }, []);

  function loadJobs(trackId) {
    if (!trackId) return;
    fetch(`/api/jobs?track=${trackId}`)
      .then(r => r.json())
      .then(setJobs)
      .catch(err => console.error('Failed to load jobs:', err));
  }

  useEffect(() => { if (activeTrack) loadJobs(activeTrack); }, [activeTrack]);

  useEffect(() => {
    if (!isRefreshing || !activeTrack) return;
    const id = setInterval(() => loadJobs(activeTrack), 3000);
    return () => clearInterval(id);
  }, [isRefreshing, activeTrack]);

  // Background auto-refresh every 60s when idle
  useEffect(() => {
    if (!activeTrack) return;
    const id = setInterval(() => { if (!isRefreshing) loadJobs(activeTrack); }, 60000);
    return () => clearInterval(id);
  }, [activeTrack, isRefreshing]);

  // Client-side filtering + dedup by (title, company): keep highest match_score per pair.
  // Wrapped in useMemo so the array reference only changes when data/filters/sort change,
  // not on every re-render triggered by selectedJob — preventing pagination from resetting.
  const filteredJobs = useMemo(() => {
    const filtered = jobs.filter(job => {
      // Hide 'Not interested' jobs unless the user is explicitly filtering to them
      if (job.status === 'Not interested' && filters.status !== 'Not interested') return false;
      if (filters.tier   && job.match_tier !== filters.tier)   return false;
      if (filters.status && job.status     !== filters.status) return false;
      if (filters.days) {
        const cutoff = Date.now() - Number(filters.days) * DAY_MS;
        if (jobDate(job) < cutoff) return false;
      }
      return true;
    });
    const seen = new Map();
    for (const job of filtered) {
      const key = `${job.title}||${job.company}`;
      const existing = seen.get(key);
      if (!existing || (job.match_score ?? -1) > (existing.match_score ?? -1)) {
        seen.set(key, job);
      }
    }
    const deduped = [...seen.values()];
    if (sort === 'date') {
      deduped.sort((a, b) => {
        const da = a.date_posted || a.scraped_at || '';
        const db = b.date_posted || b.scraped_at || '';
        return db.localeCompare(da);
      });
    } else {
      deduped.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
    }
    return deduped;
  }, [jobs, filters, sort]);

  // Sidebar counts always from the full unfiltered list
  const cutoff1  = Date.now() - 1  * DAY_MS;
  const cutoff3  = Date.now() - 3  * DAY_MS;
  const cutoff7  = Date.now() - 7  * DAY_MS;
  const cutoff30 = Date.now() - 30 * DAY_MS;
  const sidebarCounts = {
    strong:    jobs.filter(j => j.match_tier === 'Strong Match').length,
    good:      jobs.filter(j => j.match_tier === 'Good Match').length,
    stretch:   jobs.filter(j => j.match_tier === 'Stretch').length,
    days1:     jobs.filter(j => jobDate(j) >= cutoff1).length,
    days3:     jobs.filter(j => jobDate(j) >= cutoff3).length,
    days7:     jobs.filter(j => jobDate(j) >= cutoff7).length,
    days30:    jobs.filter(j => jobDate(j) >= cutoff30).length,
    saved:        jobs.filter(j => j.status === 'Saved').length,
    applied:      jobs.filter(j => j.status === 'Applied').length,
    interview:    jobs.filter(j => j.status === 'Interview').length,
    offer:        jobs.filter(j => j.status === 'Offer').length,
    rejected:     jobs.filter(j => j.status === 'Rejected').length,
    notInterested: jobs.filter(j => j.status === 'Not interested').length,
  };

  function switchTrack(id) {
    setActiveTrack(id);
    setSelectedJob(null);
    setFilters({ tier: '', status: '', days: '' });
    setSort('score');
  }

  function setFilter(key, value) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  function handleRefresh() {
    if (!activeTrack || isRefreshing) return;
    setRefreshMode('scrape');
    setIsRefreshing(true);
    fetch(`/api/scrape/${activeTrack}`, { method: 'POST' })
      .catch(() => setIsRefreshing(false));
  }

  function handleAnalyze() {
    if (!activeTrack || isRefreshing) return;
    setRefreshMode('analyze');
    setIsRefreshing(true);
    fetch(`/api/analyze/${activeTrack}`, { method: 'POST' })
      .catch(() => setIsRefreshing(false));
  }

  function handleScrapeComplete() {
    setIsRefreshing(false);
    loadJobs(activeTrack);
  }

  function handleStatusChange(jobId, newStatus) {
    fetch(`/api/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(r => r.json())
      .then(updated => {
        setJobs(prev => prev.map(j => j.id === updated.id ? { ...j, status: updated.status } : j));
        setSelectedJob(prev => prev?.id === updated.id ? { ...prev, status: updated.status } : prev);
      });
  }

  const TIER_FILTERS = [
    { v: '',             label: 'All tiers',    icon: 'ti-stack',        count: jobs.length },
    { v: 'Strong Match', label: 'Strong match', icon: 'ti-circle-check', count: sidebarCounts.strong },
    { v: 'Good Match',   label: 'Good match',   icon: 'ti-circle-half',  count: sidebarCounts.good },
    { v: 'Stretch',      label: 'Stretch',      icon: 'ti-circle',       count: sidebarCounts.stretch },
  ];

  const STATUS_FILTERS = [
    { v: '',               label: 'All statuses',  icon: 'ti-inbox' },
    { v: 'Saved',          label: 'Saved',          icon: 'ti-bookmark', count: sidebarCounts.saved },
    { v: 'Applied',        label: 'Applied',        icon: 'ti-send',     count: sidebarCounts.applied },
    { v: 'Interview',      label: 'Interview',      icon: 'ti-users',    count: sidebarCounts.interview },
    { v: 'Offer',          label: 'Offer',          icon: 'ti-trophy',   count: sidebarCounts.offer },
    { v: 'Rejected',       label: 'Rejected',       icon: 'ti-x',        count: sidebarCounts.rejected },
    { v: 'Not interested', label: 'Not interested', icon: 'ti-eye-off',  count: sidebarCounts.notInterested },
  ];

  const DATE_FILTERS = [
    { v: '',   label: 'All dates',    icon: 'ti-calendar' },
    { v: '1',  label: 'Last 24 hours', icon: 'ti-clock',          count: sidebarCounts.days1 },
    { v: '3',  label: 'Last 3 days',   icon: 'ti-clock',          count: sidebarCounts.days3 },
    { v: '7',  label: 'Last 7 days',   icon: 'ti-clock',          count: sidebarCounts.days7 },
    { v: '30', label: 'Last 30 days',  icon: 'ti-calendar-month', count: sidebarCounts.days30 },
  ];

  return (
    <div className="ht-app">
      {/* Topbar */}
      <header className="ht-topbar">
        <div className="ht-topbar-left">
          <div className="ht-logo">
            <div className="ht-logo-dot" />
            HireTrack
          </div>
          <div className="ht-tabs">
            {tracks.map(t => (
              <button
                key={t.id}
                onClick={() => switchTrack(t.id)}
                className={`ht-tab${activeTrack === t.id ? ' active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ht-topbar-actions">
          <button onClick={handleRefresh} disabled={isRefreshing} className="ht-btn">
            <i className="ti ti-refresh" />
            {isRefreshing && refreshMode === 'scrape' ? 'Scraping…' : 'Refresh'}
          </button>
          <button onClick={handleAnalyze} disabled={isRefreshing} className="ht-btn ht-btn-dark">
            <i className="ti ti-bolt" />
            {isRefreshing && refreshMode === 'analyze' ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </header>

      <ScrapeProgress
        trackId={activeTrack}
        isActive={isRefreshing}
        mode={refreshMode}
        onComplete={handleScrapeComplete}
      />

      {/* Main */}
      <div className="ht-main">
        {/* Sidebar */}
        <aside className="ht-sidebar">
          <div className="ht-filter-group">
            <div className="ht-filter-label">Match level</div>
            {TIER_FILTERS.map(item => (
              <button
                key={item.v}
                onClick={() => setFilter('tier', item.v)}
                className={`ht-filter-item${filters.tier === item.v ? ' active' : ''}`}
              >
                <i className={`ti ${item.icon}`} />
                <span>{item.label}</span>
                <span className="ht-filter-count">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="ht-sidebar-divider" />

          <div className="ht-filter-group">
            <div className="ht-filter-label">Status</div>
            {STATUS_FILTERS.map(item => (
              <button
                key={item.v}
                onClick={() => setFilter('status', item.v)}
                className={`ht-filter-item${filters.status === item.v ? ' active' : ''}`}
              >
                <i className={`ti ${item.icon}`} />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="ht-filter-count">{item.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="ht-sidebar-divider" />

          <div className="ht-filter-group">
            <div className="ht-filter-label">Posted</div>
            {DATE_FILTERS.map(item => (
              <button
                key={item.v}
                onClick={() => setFilter('days', item.v)}
                className={`ht-filter-item${filters.days === item.v ? ' active' : ''}`}
              >
                <i className={`ti ${item.icon}`} />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="ht-filter-count">{item.count}</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="ht-content">
          <JobList
            jobs={filteredJobs}
            selectedJob={selectedJob}
            onSelect={setSelectedJob}
            onStatusChange={handleStatusChange}
            sort={sort}
            onSortChange={setSort}
          />
          {selectedJob && (
            <JobDetail
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
