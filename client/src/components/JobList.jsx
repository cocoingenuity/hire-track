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

export default function JobList({
  jobs, selectedJob, onSelect, onStatusChange, sort, onSortChange,
  selectedJobIds, analyzingJobIds, onToggleSelect, onSelectAll, onClearSelection,
}) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [jobs]);

  const allSelected  = jobs.length > 0 && jobs.every(j => selectedJobIds.has(j.id));
  const someSelected = !allSelected && jobs.some(j => selectedJobIds.has(j.id));

  function handleSelectAll(e) {
    e.stopPropagation();
    if (allSelected) {
      onClearSelection();
    } else {
      onSelectAll(jobs.map(j => j.id));
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="ht-job-list">
        <div className="flex justify-between items-center w-full mb-6 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="ht-list-title">Matching positions</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="ht-sort-toggle" style={{ padding: '3px' }}>
              <button onClick={() => onSortChange('score')} className={`ht-sort-btn${sort === 'score' ? ' active' : ''}`}>Best match</button>
              <button onClick={() => onSortChange('date')}  className={`ht-sort-btn${sort === 'date'  ? ' active' : ''}`}>Newest first</button>
            </div>
            <span className="ht-list-count">0 jobs</span>
          </div>
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
      <div className="flex justify-between items-center w-full mb-6 pb-2 border-b border-gray-100">
        {/* Left: Select All + Title */}
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0 transition-colors cursor-pointer"
            style={{
              background: allSelected ? 'var(--ht-green)' : 'var(--ht-bg-3)',
              border: `1px solid ${allSelected || someSelected ? 'var(--ht-green)' : 'var(--ht-border-2)'}`,
            }}
            onClick={handleSelectAll}
            title={allSelected ? 'Deselect all' : 'Select all'}
          >
            {allSelected  && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} />}
            {someSelected && <i className="ti ti-minus" style={{ fontSize: 11, color: 'var(--ht-green)' }} />}
          </span>
          <span className="ht-list-title">Matching positions</span>
        </div>

        {/* Right: Sort toggle + count */}
        <div className="flex items-center gap-4">
          <div className="ht-sort-toggle" style={{ padding: '3px' }}>
            <button onClick={() => onSortChange('score')} className={`ht-sort-btn${sort === 'score' ? ' active' : ''}`}>Best match</button>
            <button onClick={() => onSortChange('date')}  className={`ht-sort-btn${sort === 'date'  ? ' active' : ''}`}>Newest first</button>
          </div>
          <span className="ht-list-count">{jobs.length} jobs</span>
        </div>
      </div>

      {pageJobs.map(job => (
        <JobCard
          key={job.id}
          job={job}
          isSelected={selectedJob?.id === job.id}
          onSelect={onSelect}
          onStatusChange={onStatusChange}
          isChecked={selectedJobIds.has(job.id)}
          isAnalyzing={analyzingJobIds.has(job.id)}
          onToggleCheck={onToggleSelect}
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
