import { useState, useEffect, useMemo, useRef } from 'react';
import JobList from './components/JobList';
import ScrapeProgress from './components/ScrapeProgress';
import JobDetail from './components/JobDetail';
import StrategySettings from './components/StrategySettings';

const DAY_MS = 24 * 60 * 60 * 1000;

// Non-actionable statuses hidden in the default view (when no status filter is
// selected). Selecting any status filter overrides this and shows that status.
const HIDDEN_STATUSES = ['Applied', 'Rejected', 'Not interested'];

// Prefer date_posted (job listing date) over scraped_at for date filters.
// date_posted is YYYY-MM-DD (parse as UTC midnight); scraped_at is "YYYY-MM-DD HH:MM:SS" (UTC).
function jobDate(job) {
  if (job.date_posted) return new Date(job.date_posted + 'T00:00:00Z').getTime();
  if (job.scraped_at)  return new Date(job.scraped_at  + 'Z').getTime();
  return 0;
}

export default function App() {
  const [view, setView]               = useState('jobs'); // 'jobs' | 'settings'
  const [tracks, setTracks]           = useState([]);
  const [activeTrack, setActiveTrack] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMode, setRefreshMode] = useState('scrape');
  const [pauseState, setPauseState] = useState(null); // null | 'paused'
  const [scrapeToast, setScrapeToast] = useState(null); // { type: 'success'|'info'|'error', message }
  const [jobs, setJobs]               = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedJobIds, setSelectedJobIds] = useState(new Set());
  const [analyzingJobIds, setAnalyzingJobIds] = useState(new Set());
  const [filters, setFilters]         = useState({ tier: '', status: '', days: '', analysis: '' });
  const [sort, setSort]               = useState('score'); // 'score' | 'date'
  const [showNewTrack, setShowNewTrack] = useState(false);
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackEmoji, setNewTrackEmoji] = useState('');
  const [newTrackFile, setNewTrackFile] = useState(null);
  const [newTrackError, setNewTrackError] = useState('');
  const newTrackFileRef = useRef(null);
  // Tracks the most recently *requested* track so stale fetch responses
  // from a previous tab can be discarded before calling setJobs.
  const activeTrackRef = useRef(activeTrack);
  const [customTab, setCustomTab]     = useState(null); // { id, label } | null
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResumeTrack, setSearchResumeTrack] = useState('');

  useEffect(() => {
    fetch('/api/tracks')
      .then(r => r.json())
      .then(data => {
        setTracks(data);
        if (data.length > 0) {
          setActiveTrack(data[0].id);
          setSearchResumeTrack(data[0].id);
        }
      })
      .catch(err => console.error('Failed to load tracks:', err));
  }, []);

  function loadJobs(trackId) {
    if (!trackId) return;
    activeTrackRef.current = trackId;
    fetch(`/api/jobs?track=${trackId}`)
      .then(r => r.json())
      .then(data => {
        // Discard if the user switched tabs while this fetch was in-flight.
        if (activeTrackRef.current === trackId) setJobs(data);
      })
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
      // Tier and status filters combine. When a specific status is selected, show
      // only jobs with that status — together with the active tier, if any.
      // e.g. "Strong Match" + "Applied" → only applied Strong-Match jobs.
      if (filters.status && job.status !== filters.status) return false;
      // Default focus (no status selected): hide non-actionable statuses
      // (Applied / Rejected / Not interested) regardless of the tier filter,
      // so the list stays on jobs worth acting on.
      if (!filters.status && HIDDEN_STATUSES.includes(job.status)) return false;
      if (filters.tier && job.match_tier !== filters.tier) return false;
      if (filters.analysis === 'analyzed'   && job.match_score == null)  return false;
      if (filters.analysis === 'unanalyzed' && job.match_score != null)  return false;
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
    analyzed:   jobs.filter(j => j.match_score != null).length,
    unanalyzed: jobs.filter(j => j.match_score == null).length,
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
    setSelectedJobIds(new Set());
    setAnalyzingJobIds(new Set());
    setFilters({ tier: '', status: '', days: '', analysis: '' });
    setSort('score');
    setCustomTab(null);
  }

  function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim() || isRefreshing) return;
    setRefreshMode('scrape');
    setIsRefreshing(true);
    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery.trim(), resume_track: searchResumeTrack }),
    })
      .then(r => r.json())
      .then(data => {
        const tab = { id: data.track_id, label: searchQuery.trim() };
        setCustomTab(tab);
        setActiveTrack(data.track_id);
        setSelectedJob(null);
        setFilters({ tier: '', status: '', days: '' });
        setSort('score');
      })
      .catch(() => setIsRefreshing(false));
  }

  function toggleSelectJob(jobId) {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  }

  function selectAllJobs(jobIds) {
    setSelectedJobIds(new Set(jobIds));
  }

  function clearSelection() {
    setSelectedJobIds(new Set());
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

  function handleAnalyzeSelected() {
    if (!activeTrack || isRefreshing) return;
    const targetIds = selectedJobIds.size > 0
      ? [...selectedJobIds]
      : jobs.filter(j => j.match_score == null).map(j => j.id);
    if (targetIds.length === 0) return;
    setRefreshMode('analyze');
    setIsRefreshing(true);
    setAnalyzingJobIds(new Set(targetIds));
    fetch('/api/analyze/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: targetIds, trackId: activeTrack }),
    }).catch(() => { setIsRefreshing(false); setAnalyzingJobIds(new Set()); });
  }

  function handlePause() {
    setPauseState('paused');
    fetch(`/api/pause/${activeTrack}`, { method: 'POST' });
  }

  function handleResume() {
    setPauseState(null);
    const endpoint = refreshMode === 'scrape'
      ? `/api/scrape/${activeTrack}`
      : `/api/analyze/${activeTrack}`;
    fetch(endpoint, { method: 'POST' })
      .catch(() => setIsRefreshing(false));
  }

  function handleStop() {
    setIsRefreshing(false);
    setPauseState(null);
    setAnalyzingJobIds(new Set());
    fetch(`/api/stop/${activeTrack}`, { method: 'POST' });
  }

  function handleScrapeComplete(runData) {
    setIsRefreshing(false);
    setPauseState(null);
    setAnalyzingJobIds(new Set());
    setSelectedJobIds(new Set());
    loadJobs(activeTrack);

    if (!runData || runData.status === 'error') {
      setScrapeToast({ type: 'error', message: runData?.error_msg ? `Failed: ${runData.error_msg}` : 'Scrape failed — check server logs.' });
    } else {
      setScrapeToast({ type: runData.toastType || 'info', message: runData.message || 'Done.' });
    }
    setTimeout(() => setScrapeToast(null), 8000);
  }

  async function handleCreateTrack(e) {
    e.preventDefault();
    setNewTrackError('');
    const name = newTrackName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      const r = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, emoji: newTrackEmoji.trim() }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create track');
      }
      if (newTrackFile) {
        const fd = new FormData();
        fd.append('resume', newTrackFile);
        await fetch(`/api/tracks/${encodeURIComponent(id)}/resume`, { method: 'POST', body: fd });
      }
      const updated = await fetch('/api/tracks').then(r2 => r2.json());
      setTracks(updated);
      switchTrack(id);
      setShowNewTrack(false);
      setNewTrackName('');
      setNewTrackEmoji('');
      setNewTrackFile(null);
      if (newTrackFileRef.current) newTrackFileRef.current.value = '';
    } catch (err) {
      setNewTrackError(err.message);
    }
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

  const ANALYSIS_FILTERS = [
    { v: '',           label: 'All',        icon: 'ti-cpu',         count: jobs.length },
    { v: 'analyzed',   label: 'Analyzed',   icon: 'ti-circle-check', count: sidebarCounts.analyzed },
    { v: 'unanalyzed', label: 'Unanalyzed', icon: 'ti-clock',       count: sidebarCounts.unanalyzed },
  ];

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
            {tracks.map(t => {
              const isActive = activeTrack === t.id;
              const label = t.name.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
              return (
                <span key={t.id} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    onClick={() => switchTrack(t.id)}
                    className={`ht-tab${isActive ? ' active' : ''}`}
                    style={{ paddingRight: isActive ? 22 : undefined }}
                  >
                    {label}
                  </button>
                  {isActive && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (!confirm(`Delete "${label}" and all its job data? This cannot be undone.`)) return;
                        fetch(`/api/tracks/${encodeURIComponent(t.id)}`, { method: 'DELETE' })
                          .then(r => r.ok ? r.json() : Promise.reject())
                          .then(() => {
                            const remaining = tracks.filter(x => x.id !== t.id);
                            setTracks(remaining);
                            switchTrack(remaining.length > 0 ? remaining[0].id : null);
                          })
                          .catch(() => alert('Failed to delete track.'));
                      }}
                      title={`Delete ${label}`}
                      style={{
                        position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px',
                        color: 'var(--ht-text-3)', lineHeight: 1, fontSize: 11,
                      }}
                    >
                      <i className="ti ti-x" />
                    </button>
                  )}
                </span>
              );
            })}
            <button
              onClick={() => setShowNewTrack(true)}
              className="ht-tab"
              title="Add new track"
              style={{ opacity: 0.6 }}
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} />
            </button>
            {customTab && (
              <button
                key={customTab.id}
                onClick={() => { setActiveTrack(customTab.id); setSelectedJob(null); }}
                className={`ht-tab ht-tab-custom${activeTrack === customTab.id ? ' active' : ''}`}
              >
                <i className="ti ti-search" />
                {customTab.label}
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSearch} className="ht-search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search any job title…"
            className="ht-search-input"
            disabled={isRefreshing}
          />
          <select
            value={searchResumeTrack}
            onChange={e => setSearchResumeTrack(e.target.value)}
            className="ht-search-select"
            disabled={isRefreshing}
          >
            {tracks.map(t => (
              <option key={t.id} value={t.id}>{t.label} resume</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isRefreshing || !searchQuery.trim()}
            className="ht-btn"
          >
            <i className="ti ti-search" />
            Search
          </button>
        </form>

        <div className="ht-topbar-actions">
          {view === 'jobs' && !activeTrack?.startsWith('search:') && (
            <>
              <button onClick={handleRefresh} disabled={isRefreshing} className="ht-btn">
                <i className="ti ti-refresh" />
                {isRefreshing && refreshMode === 'scrape' ? 'Scraping…' : 'Refresh'}
              </button>
              <button
                onClick={handleAnalyzeSelected}
                disabled={isRefreshing}
                className="ht-btn ht-btn-dark"
              >
                <i className="ti ti-bolt" />
                {isRefreshing && refreshMode === 'analyze'
                  ? 'Analyzing…'
                  : selectedJobIds.size > 0
                    ? `Analyze (${selectedJobIds.size})`
                    : 'Analyze'}
              </button>
            </>
          )}
          <button
            onClick={() => setView(v => v === 'settings' ? 'jobs' : 'settings')}
            className={`ht-btn${view === 'settings' ? ' ht-btn-dark' : ''}`}
            title="Strategy Settings"
          >
            <i className="ti ti-settings" />
            Strategy
          </button>
        </div>
      </header>

      <ScrapeProgress
        trackId={activeTrack}
        isActive={isRefreshing}
        mode={refreshMode}
        onComplete={handleScrapeComplete}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        pauseState={pauseState}
      />

      {scrapeToast && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px', fontSize: 12.5,
          background: scrapeToast.type === 'success' ? '#F0FBF6' : scrapeToast.type === 'error' ? '#FEF2F2' : 'var(--ht-bg)',
          color:      scrapeToast.type === 'success' ? '#0F6E56' : scrapeToast.type === 'error' ? '#B91C1C' : 'var(--ht-text-2)',
          borderBottom: '0.5px solid var(--ht-border)',
        }}>
          <i className={`ti ${scrapeToast.type === 'success' ? 'ti-circle-check' : scrapeToast.type === 'error' ? 'ti-alert-circle' : 'ti-info-circle'}`} style={{ fontSize: 14 }} />
          <span style={{ flex: 1 }}>{scrapeToast.message}</span>
          <button onClick={() => setScrapeToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.55, padding: 0 }}>
            <i className="ti ti-x" style={{ fontSize: 12 }} />
          </button>
        </div>
      )}

      {/* New Track Modal */}
      {showNewTrack && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) setShowNewTrack(false); }}>
          <div style={{
            background: 'var(--ht-bg)', border: '0.5px solid var(--ht-border)',
            borderRadius: 14, padding: 28, width: 380, display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ht-text)', margin: 0 }}>New Track</h2>
              <p style={{ fontSize: 12, color: 'var(--ht-text-3)', marginTop: 4 }}>Create a new job search track with its own strategy and resume.</p>
            </div>
            <form onSubmit={handleCreateTrack} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Emoji (optional)"
                  value={newTrackEmoji}
                  onChange={e => setNewTrackEmoji(e.target.value)}
                  maxLength={4}
                  style={{ width: 80, padding: '8px 10px', borderRadius: 8, fontSize: 13, background: 'var(--ht-bg-2)', border: '0.5px solid var(--ht-border-2)', color: 'var(--ht-text)', outline: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Track name (e.g. Software Dev)"
                  value={newTrackName}
                  onChange={e => setNewTrackName(e.target.value)}
                  required
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'var(--ht-bg-2)', border: '0.5px solid var(--ht-border-2)', color: 'var(--ht-text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--ht-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Resume PDF (optional)
                </label>
                <input
                  ref={newTrackFileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={e => setNewTrackFile(e.target.files?.[0] || null)}
                  style={{ fontSize: 12, color: 'var(--ht-text-2)' }}
                />
              </div>
              {newTrackError && (
                <p style={{ fontSize: 12, color: '#e05', margin: 0 }}>{newTrackError}</p>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="ht-btn" onClick={() => setShowNewTrack(false)} style={{ padding: '7px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="ht-btn ht-btn-dark" style={{ padding: '7px 16px' }}>
                  <i className="ti ti-plus" />
                  Create Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="ht-main">
        {view === 'settings' ? (
          <StrategySettings
            trackId={activeTrack}
            track={tracks.find(t => t.id === activeTrack)}
            onClose={() => setView('jobs')}
          />
        ) : (
          <>
            {/* Sidebar */}
            <aside className="ht-sidebar">
              <div className="ht-filter-group">
                <div className="ht-filter-label">AI Analysis</div>
                {ANALYSIS_FILTERS.map(item => (
                  <button
                    key={item.v}
                    onClick={() => setFilter('analysis', item.v)}
                    className={`ht-filter-item${filters.analysis === item.v ? ' active' : ''}`}
                  >
                    <i className={`ti ${item.icon}`} />
                    <span>{item.label}</span>
                    <span className="ht-filter-count">{item.count}</span>
                  </button>
                ))}
              </div>

              <div className="ht-sidebar-divider" />

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
                selectedJobIds={selectedJobIds}
                analyzingJobIds={analyzingJobIds}
                onToggleSelect={toggleSelectJob}
                onSelectAll={selectAllJobs}
                onClearSelection={clearSelection}
              />
              {selectedJob && (
                <JobDetail
                  job={selectedJob}
                  onClose={() => setSelectedJob(null)}
                  onStatusChange={handleStatusChange}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
