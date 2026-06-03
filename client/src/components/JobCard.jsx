function formatDate(date_posted) {
  if (!date_posted) return '';
  const [y, m, d] = date_posted.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const PILL = {
  'Strong Match': { cls: 'ht-score-pill-strong' },
  'Good Match':   { cls: 'ht-score-pill-good'   },
  'Stretch':      { cls: 'ht-score-pill-stretch' },
  'Skip':         { cls: 'ht-score-pill-skip'    },
};

export default function JobCard({ job, isSelected, onSelect, onStatusChange, isChecked, isAnalyzing, onToggleCheck }) {
  const pill = PILL[job.match_tier] || PILL['Skip'];
  const dateLabel = job.date_posted
    ? formatDate(job.date_posted)
    : job.source === 'indeed' ? 'Within 7 days' : '';

  function handleBookmark(e) {
    e.stopPropagation();
    onStatusChange(job.id, job.status === 'Saved' ? '' : 'Saved');
  }

  function handleCheck(e) {
    e.stopPropagation();
    onToggleCheck(job.id);
  }

  return (
    <div
      onClick={() => onSelect(job)}
      className={`ht-job-card${isSelected ? ' selected' : ''}`}
    >
      {/* Checkbox — small and subtle; revealed by CSS on card hover or when checked */}
      <span
        className={`job-checkbox flex items-center justify-center flex-shrink-0 rounded cursor-pointer transition-colors${isChecked ? ' is-checked' : ''}`}
        style={{
          width: 14, height: 14,
          background: isChecked ? 'var(--ht-green)' : 'var(--ht-bg-3)',
          border: `1px solid ${isChecked ? 'var(--ht-green)' : 'var(--ht-border-2)'}`,
        }}
        onClick={handleCheck}
      >
        {isChecked && <i className="ti ti-check" style={{ fontSize: 9, color: '#fff' }} />}
      </span>

      {/* Title + meta */}
      <div className="ht-job-card-left">
        <div className="ht-job-title">{job.title}</div>
        <div className="ht-job-meta">
          <span>{job.company}</span>
          {job.location && (
            <><span className="ht-meta-dot" /><span>{job.location}</span></>
          )}
          {dateLabel && (
            <><span className="ht-meta-dot" /><span>{dateLabel}</span></>
          )}
        </div>
      </div>

      {/* Score pill + bookmark */}
      <div className="ht-job-card-right">
        {isAnalyzing ? (
          <div className="ht-score-pill ht-score-pill-skip" style={{ opacity: 0.6 }} title="Analyzing…">
            <i className="ti ti-loader-2" style={{ fontSize: 12, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div className={`ht-score-pill ${job.match_tier ? pill.cls : 'ht-score-pill-skip'}`}>
            {job.match_score ?? '—'}
          </div>
        )}
        <button
          onClick={handleBookmark}
          className={`ht-bookmark-btn${job.status === 'Saved' ? ' saved' : ''}`}
          title={job.status === 'Saved' ? 'Remove from saved' : 'Save job'}
        >
          <i className="ti ti-bookmark" />
        </button>
      </div>
    </div>
  );
}
