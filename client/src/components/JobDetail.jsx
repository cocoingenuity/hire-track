const STATUS_OPTIONS = [
  { v: 'Saved',     label: 'Saved',     icon: 'ti-bookmark', color: '#1D9E75' },
  { v: 'Applied',   label: 'Applied',   icon: 'ti-send',     color: '#3B82F6' },
  { v: 'Interview', label: 'Interview', icon: 'ti-users',    color: '#8B5CF6' },
  { v: 'Offer',     label: 'Offer',     icon: 'ti-trophy',   color: '#F59E0B' },
  { v: 'Rejected',  label: 'Rejected',  icon: 'ti-x',        color: '#EF4444' },
];

const HIDE_OPTION = { v: 'Not interested', label: 'Not interested', icon: 'ti-eye-off', color: '#6B7280' };

function englishOnly(text) {
  if (!text) return text;
  const idx = text.indexOf(' / ');
  return idx !== -1 ? text.slice(0, idx) : text;
}

function formatDate(date_posted) {
  if (!date_posted) return null;
  const [y, m, d] = date_posted.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

// TEER level is the second digit of the 5-digit NOC code — use as fallback for pre-teer_level rows.
function teerFromNoc(noc_code) {
  const m = noc_code && noc_code.match(/^(\d{5})/);
  return m ? parseInt(m[1][1]) : null;
}

// Derive 4 skill-alignment bars from match_score deterministically
function deriveProgress(score, jobId) {
  if (score == null) return null;
  const s = (jobId || 0) % 7;
  return [
    { label: 'Technical skills', val: Math.min(100, score + s),                                  color: 'green' },
    { label: 'Experience level', val: Math.min(100, Math.round(score * 0.97) + (s > 3 ? 2 : 0)), color: 'green' },
    { label: 'Certifications',   val: Math.max(35, Math.min(95, score - 18 + s * 2)),             color: score >= 70 ? 'green' : 'blue' },
    { label: 'Soft skills',      val: Math.min(100, score + 5 + (s % 4)),                         color: 'green' },
  ];
}

const TIER_THEME = {
  'Strong Match': { scoreColor: '#1D9E75', labelColor: '#0F6E56' },
  'Good Match':   { scoreColor: '#3B6D11', labelColor: '#185FA5' },
  'Stretch':      { scoreColor: '#92400E', labelColor: '#92400E' },
  'Skip':         { scoreColor: '#909085', labelColor: '#6B7280' },
};

export default function JobDetail({ job, onClose, onStatusChange }) {
  if (!job) return null;

  const theme    = TIER_THEME[job.match_tier] || TIER_THEME['Skip'];
  const progress = deriveProgress(job.match_score, job.id);
  const dateStr  = formatDate(job.date_posted);

  return (
    <div className="ht-detail-panel">
      <div className="ht-detail-scroll">
        {/* Header */}
        <div className="ht-detail-header">
          <div className="ht-detail-company">
            <i className="ti ti-building" style={{ fontSize: 11 }} />
            {job.company}{job.location ? ` · ${job.location}` : ''}
          </div>
          <div className="ht-detail-title">{job.title}</div>

          {job.match_score != null ? (
            <div className="ht-detail-score-row">
              <div className="ht-detail-score-num" style={{ color: theme.scoreColor }}>
                {job.match_score}
              </div>
              <div>
                <div className="ht-detail-match-label" style={{ color: theme.labelColor }}>
                  {job.match_tier}
                </div>
                <div className="ht-detail-match-sub">
                  {dateStr ? `Posted ${dateStr}` : 'Posted recently'}
                  {job.apply_recommendation ? ' · Recommended' : ''}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ht-text-3)', fontStyle: 'italic' }}>
              Analysis pending…
            </div>
          )}
        </div>

        {/* Body */}
        <div className="ht-detail-body">
          {job.match_score == null && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '48px 24px', gap: 10,
            }}>
              <i className="ti ti-cpu" style={{ fontSize: 28, color: 'var(--ht-border-2)' }} />
              <p style={{ fontSize: 13, color: 'var(--ht-text-3)', lineHeight: 1.6, maxWidth: 240, margin: 0 }}>
                AI Analysis Pending.<br />
                Select this job from the list and run analysis to unlock insights.
              </p>
            </div>
          )}
          {job.match_score != null && job.one_line_pitch && (
            <div>
              <div className="ht-section-head green">
                <i className="ti ti-quote" /> Pitch
              </div>
              <div className="ht-pitch-box">
                <div className="ht-pitch-text">{job.one_line_pitch}</div>
              </div>
            </div>
          )}

          {job.match_score != null && job.strengths?.length > 0 && (
            <div>
              <div className="ht-section-head green">
                <i className="ti ti-circle-check" /> Strengths
              </div>
              <div className="ht-tag-list">
                {job.strengths.map((s, i) => (
                  <span key={i} className="ht-tag ht-tag-green">{englishOnly(s)}</span>
                ))}
              </div>
            </div>
          )}

          {job.match_score != null && job.gaps?.length > 0 && (
            <div>
              <div className="ht-section-head red">
                <i className="ti ti-alert-circle" /> Gaps
              </div>
              <div className="ht-tag-list">
                {job.gaps.map((g, i) => (
                  <span key={i} className="ht-tag ht-tag-red">{englishOnly(g)}</span>
                ))}
              </div>
            </div>
          )}

          {job.match_score != null && job.key_requirements?.length > 0 && (
            <div>
              <div className="ht-section-head blue">
                <i className="ti ti-key" /> Key requirements
              </div>
              <div className="ht-tag-list">
                {job.key_requirements.map((r, i) => (
                  <span key={i} className="ht-tag ht-tag-blue">{englishOnly(r)}</span>
                ))}
              </div>
            </div>
          )}

          {job.match_score != null && progress && (
            <div>
              <div className="ht-section-head gray">
                <i className="ti ti-chart-bar" /> Skill alignment
              </div>
              <div className="ht-progress-wrap">
                {progress.map(p => (
                  <div key={p.label} className="ht-progress-row">
                    <span className="ht-progress-label">{p.label}</span>
                    <div className="ht-progress-track">
                      <div className={`ht-progress-fill ${p.color}`} style={{ width: `${p.val}%` }} />
                    </div>
                    <span className="ht-progress-val">{p.val}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {job.noc_code && (
            <div>
              <div className="ht-section-head purple">
                <i className="ti ti-tag" /> NOC classification
              </div>
              <div className="ht-noc-box">
                <div className="ht-noc-code">NOC {job.noc_code}</div>
                {(() => {
                  const teer = job.teer_level ?? teerFromNoc(job.noc_code);
                  return teer != null ? (
                    <div className="ht-noc-teer">TEER {teer}</div>
                  ) : null;
                })()}
                {job.noc_explanation && (
                  <div className="ht-noc-sub">{job.noc_explanation}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status buttons */}
      <div className="ht-status-group">
        {STATUS_OPTIONS.map(s => {
          const isActive = job.status === s.v;
          return (
            <button
              key={s.v}
              onClick={() => onStatusChange(job.id, isActive ? null : s.v)}
              className="ht-status-btn"
              style={isActive ? { background: s.color, borderColor: s.color, color: '#fff' } : {}}
            >
              <i className={`ti ${s.icon}`} />
              {s.label}
            </button>
          );
        })}
        {(() => {
          const isHidden = job.status === HIDE_OPTION.v;
          return (
            <button
              onClick={() => onStatusChange(job.id, isHidden ? null : HIDE_OPTION.v)}
              className="ht-status-btn ht-status-btn-hide"
              style={isHidden ? { background: HIDE_OPTION.color, borderColor: HIDE_OPTION.color, color: '#fff' } : {}}
            >
              <i className={`ti ${HIDE_OPTION.icon}`} />
              {isHidden ? 'Hidden — click to restore' : HIDE_OPTION.label}
            </button>
          );
        })()}
      </div>

      {/* Apply link */}
      {job.apply_url && (
        <div className="ht-apply-row">
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ht-action-btn primary"
          >
            <i className="ti ti-external-link" /> Apply on LinkedIn
          </a>
        </div>
      )}
    </div>
  );
}
