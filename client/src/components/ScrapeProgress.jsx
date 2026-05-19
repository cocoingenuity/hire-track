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
