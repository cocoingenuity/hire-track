function formatDate(date_posted) {
  if (!date_posted) return '';
  const [y, m, d] = date_posted.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const BADGE = {
  'Strong Match': { cls: 'ht-badge-strong', label: 'Strong',  scoreCls: 'ht-score-high' },
  'Good Match':   { cls: 'ht-badge-good',   label: 'Good',    scoreCls: 'ht-score-mid' },
  'Stretch':      { cls: 'ht-badge-stretch',label: 'Stretch', scoreCls: 'ht-score-low' },
  'Skip':         { cls: 'ht-badge-skip',   label: 'Skip',    scoreCls: 'ht-score-empty' },
};

export default function JobCard({ job, isSelected, onSelect, onStatusChange }) {
  const cfg = BADGE[job.match_tier] || { cls: 'ht-badge-skip', label: '—', scoreCls: 'ht-score-empty' };
  const dateLabel = job.date_posted
    ? formatDate(job.date_posted)
    : job.source === 'indeed' ? 'Within 7 days' : '';

  function handleBookmark(e) {
    e.stopPropagation();
    onStatusChange(job.id, job.status === 'Saved' ? '' : 'Saved');
  }

  return (
    <div
      onClick={() => onSelect(job)}
      className={`ht-job-card${isSelected ? ' selected' : ''}`}
    >
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
      <div className="ht-job-card-right">
        {job.match_tier && (
          <span className={`ht-badge ${cfg.cls}`}>{cfg.label}</span>
        )}
        <div className={`ht-score ${job.match_score != null ? cfg.scoreCls : 'ht-score-empty'}`}>
          {job.match_score ?? '—'}
        </div>
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
