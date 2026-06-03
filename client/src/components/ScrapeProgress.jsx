import { useEffect, useRef, useState } from 'react';

export default function ScrapeProgress({ trackId, isActive, mode, onComplete, onPause, onResume, onStop, pauseState }) {
  const [stats, setStats] = useState(null);
  const intervalRef = useRef(null);
  // Always call the latest onComplete without re-creating the polling interval.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    if (!isActive || !trackId) { setStats(null); return; }

    intervalRef.current = setInterval(() => {
      fetch(`/api/scrape/status/${trackId}`)
        .then(r => r.json())
        .then(data => {
          setStats(data);
          // Only auto-dismiss on done/error; paused state is managed by Resume/Stop buttons
          if (data.status === 'done' || data.status === 'error') {
            clearInterval(intervalRef.current);
            onCompleteRef.current(data);
          }
        })
        .catch(() => { clearInterval(intervalRef.current); onCompleteRef.current({ status: 'error' }); });
    }, 2000);

    return () => clearInterval(intervalRef.current);
  }, [isActive, trackId]);

  if (!isActive) return null;

  const isPaused = pauseState === 'paused';
  const verb = mode === 'analyze' ? 'Analyzing' : 'Scraping';

  return (
    <div className="ht-progress-banner">
      <span className="ht-progress-banner-label">{isPaused ? 'Paused' : `${verb}…`}</span>
      <div className="ht-progress-banner-track">
        <div className={`ht-progress-banner-fill${isPaused ? ' paused' : ''}`} />
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
      {isPaused ? (
        <>
          <button className="ht-btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={onResume}>
            <i className="ti ti-player-play" /> Resume
          </button>
          <button className="ht-btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={onStop}>
            <i className="ti ti-square" /> Stop
          </button>
        </>
      ) : (
        <>
          <button className="ht-btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={onPause}>
            <i className="ti ti-player-pause" /> Pause
          </button>
          <button className="ht-btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={onStop}>
            <i className="ti ti-square" /> Stop
          </button>
        </>
      )}
    </div>
  );
}
