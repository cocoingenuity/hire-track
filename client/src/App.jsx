import { useState, useEffect } from 'react';
import TrackTabs from './components/TrackTabs';
import JobList from './components/JobList';
import ScrapeProgress from './components/ScrapeProgress';
import JobDetail from './components/JobDetail';

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

  function loadJobs(trackId, currentFilters) {
    const params = new URLSearchParams({ track: trackId });
    if (currentFilters.tier)   params.set('tier', currentFilters.tier);
    if (currentFilters.status) params.set('status', currentFilters.status);
    fetch(`/api/jobs?${params}`)
      .then(r => r.json())
      .then(setJobs)
      .catch(err => console.error('Failed to load jobs:', err));
  }

  useEffect(() => {
    if (activeTrack) loadJobs(activeTrack, filters);
  }, [activeTrack, filters]);

  function handleRefresh() {
    if (!activeTrack || isRefreshing) return;
    setIsRefreshing(true);
    fetch(`/api/scrape/${activeTrack}`, { method: 'POST' })
      .catch(() => setIsRefreshing(false));
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
          onSelect={id => { setActiveTrack(id); setSelectedJob(null); setFilters({ tier: '', status: '' }); }}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      <ScrapeProgress
        trackId={activeTrack}
        isActive={isRefreshing}
        onComplete={handleScrapeComplete}
      />

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
}
