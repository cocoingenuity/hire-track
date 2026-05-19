function formatScrapedAt(scraped_at) {
  if (!scraped_at) return '';
  const d = new Date(scraped_at.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const TIER_STYLES = {
  'Strong Match': { badge: 'bg-green-900 text-green-300',   border: 'border-l-green-500',  score: 'bg-green-500 text-gray-950' },
  'Good Match':   { badge: 'bg-blue-900 text-blue-300',     border: 'border-l-blue-500',   score: 'bg-blue-500 text-gray-950' },
  'Stretch':      { badge: 'bg-yellow-900 text-yellow-300', border: 'border-l-yellow-500', score: 'bg-yellow-400 text-gray-950' },
  'Skip':         { badge: 'bg-gray-800 text-gray-400',     border: 'border-l-gray-600',   score: 'bg-gray-600 text-gray-200' },
};

const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

export default function JobCard({ job, isSelected, onSelect, onStatusChange }) {
  const tier = TIER_STYLES[job.match_tier] || TIER_STYLES['Skip'];

  function handleStatusChange(e) {
    e.stopPropagation();
    onStatusChange(job.id, e.target.value);
  }

  return (
    <div
      onClick={() => onSelect(job)}
      className={`flex items-center gap-4 px-4 py-3 rounded-lg border-l-4 cursor-pointer transition-colors ${tier.border} ${
        isSelected ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{job.title}</p>
        <p className="text-gray-400 text-xs mt-0.5">
          {job.company}{job.location ? ` · ${job.location}` : ''}{(job.date_posted || job.scraped_at) ? ` · ${job.date_posted || formatScrapedAt(job.scraped_at)}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {job.match_tier && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tier.badge}`}>
            {job.match_tier}
          </span>
        )}

        {job.match_score != null ? (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${tier.score}`}>
            {job.match_score}
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs text-gray-600 border border-gray-700 shrink-0">
            —
          </div>
        )}

        <select
          value={job.status ?? ''}
          onChange={handleStatusChange}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
        >
          <option value="">—</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
