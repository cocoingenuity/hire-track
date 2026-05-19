import { useState, useEffect } from 'react';
import JobCard from './JobCard';

const PAGE_SIZE = 10;

export default function JobList({ jobs, selectedJob, onSelect, onStatusChange }) {
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [jobs]);

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-600">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm">No jobs yet. Hit Refresh to scrape.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(jobs.length / PAGE_SIZE);
  const pageJobs = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-2">
      {pageJobs.map(job => (
        <JobCard
          key={job.id}
          job={job}
          isSelected={selectedJob?.id === job.id}
          onSelect={onSelect}
          onStatusChange={onStatusChange}
        />
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-800">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, jobs.length)} of {jobs.length}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
