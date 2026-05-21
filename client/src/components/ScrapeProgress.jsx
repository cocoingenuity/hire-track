import { useEffect, useRef, useState } from 'react';

export default function ScrapeProgress({ trackId, isActive, mode, onComplete, onPause }) {
  const [stats, setStats] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isActive || !trackId) { setStats(null); return; }

    intervalRef.current = setInterval(() => {
      fetch(`/api/scrape/status/${trackId}`)
        .then(r => r.json())
        .then(data => {
          setStats(data);
          if (data.status === 'done' || data.status === 'error' || data.status === 'paused') {
            clearInterval(intervalRef.current);
            onComplete(data);
          }
        })
        .catch(() => { clearInterval(intervalRef.current); onComplete({ status: 'error' }); });
    }, 2000);

    return () => clearInterval(intervalRef.current);
  }, [isActive, trackId]);

  if (!isActive) return null;

  const verb = mode === 'analyze' ? 'Analyzing' : 'Scraping';

  return (
    <div className="ht-progress-banner">
      <span className="ht-progress-banner-label">{verb}…</span>
      <div className="ht-progress-banner-track">
        <div className="ht-progress-banner-fill" />
      </div>
      {stats && (
        <span className="ht-progress-banner-stats">
          {stats.jobs_found ?? 0} found · {stats.jobs_new ?? 0} new · {stats.jobs_analyzed ?? 0} analyzed
        </span>
      )}
      {stats?.status === 'error' && (
        <span style={{ fontSize: 12, color: '#993C1D', marginLeft: 4 }}>
          {stats.error_msg || 'Failed'}
        </span>
      )}
      <button className="ht-btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={onPause}>
        <i className="ti ti-player-pause" /> Pause
      </button>
    </div>
  );
}
