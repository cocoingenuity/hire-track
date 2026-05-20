import { useState, useEffect } from 'react';
import JobCard from './JobCard';

const PAGE_SIZE = 10;

function getPageNumbers(current, total) {
  if (total <= 10) return Array.from({ length: total }, (_, i) => i + 1);
  const show = new Set([1, total]);
  for (let p = Math.max(1, current - 4); p <= Math.min(total, current + 4); p++) show.add(p);
  const sorted = [...show].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}

export default function JobList({ jobs, selectedJob, onSelect, onStatusChange, sort, onSortChange }) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [jobs]);

  if (jobs.length === 0) {
    return (
      <div className="ht-job-list">
        <div className="ht-list-header">
          <span className="ht-list-title">Matching positions</span>
          <div className="ht-sort-toggle">
            <button onClick={() => onSortChange('score')} className={`ht-sort-btn${sort === 'score' ? ' active' : ''}`}>Best match</button>
            <button onClick={() => onSortChange('date')}  className={`ht-sort-btn${sort === 'date'  ? ' active' : ''}`}>Newest first</button>
          </div>
          <span className="ht-list-count">0 jobs</span>
        </div>
        <div className="ht-empty">
          <div className="ht-empty-icon">📭</div>
          <div className="ht-empty-text">No jobs found. Adjust filters or hit Refresh.</div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(jobs.length / PAGE_SIZE);
  const pageJobs   = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageNums   = getPageNumbers(page, totalPages);

  return (
    <div className="ht-job-list">
      <div className="ht-list-header">
        <span className="ht-list-title">Matching positions</span>
        <div className="ht-sort-toggle">
          <button onClick={() => onSortChange('score')} className={`ht-sort-btn${sort === 'score' ? ' active' : ''}`}>Best match</button>
          <button onClick={() => onSortChange('date')}  className={`ht-sort-btn${sort === 'date'  ? ' active' : ''}`}>Newest first</button>
        </div>
        <span className="ht-list-count">{jobs.length} jobs</span>
      </div>

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
        <div className="ht-pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="ht-page-btn"
          >
            ← Prev
          </button>

          {pageNums.map((p, i) =>
            p === '...'
              ? <span key={`e-${i}`} style={{ fontSize: 12, color: 'var(--ht-text-3)', padding: '0 2px' }}>…</span>
              : <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`ht-page-btn${p === page ? ' active' : ''}`}
                >
                  {p}
                </button>
          )}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="ht-page-btn"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
