import { useState, useEffect } from 'react';
import JobCard from './JobCard';

const PAGE_SIZE = 10;

function getPageNumbers(current, total) {
  if (total <= 10) return Array.from({ length: total }, (_, i) => i + 1);

  // Build a set: always include first, last, and up to 4 pages either side of current
  const show = new Set([1, total]);
  for (let p = Math.max(1, current - 4); p <= Math.min(total, current + 4); p++) show.add(p);

  // Sort and insert '...' wherever there's a gap
  const sorted = [...show].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}

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
  const pageNumbers = getPageNumbers(page, totalPages);

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
        <div className="flex items-center justify-center gap-1 pt-3 mt-1 border-t border-gray-800 flex-wrap">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-gray-800 transition-colors"
          >
            ← Prev
          </button>

          {pageNumbers.map((p, i) =>
            p === '...'
              ? <span key={`ellipsis-${i}`} className="text-xs text-gray-600 px-1 select-none">…</span>
              : <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`text-xs px-2 py-1 rounded transition-colors min-w-[1.75rem] ${
                    p === page
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  {p}
                </button>
          )}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-gray-800 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
