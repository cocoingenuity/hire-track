function BilingualText({ text }) {
  const idx = text.indexOf(' / ');
  if (idx === -1) return <span>{text}</span>;
  return (
    <>
      <span>{text.slice(0, idx)}</span>
      <span className="block text-gray-500 text-xs mt-0.5">{text.slice(idx + 3)}</span>
    </>
  );
}

export default function JobDetail({ job, onClose }) {
  if (!job) return null;

  return (
    <div className="w-96 shrink-0 border-l border-gray-800 bg-gray-900 flex flex-col">
      {/* Fixed header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-800 shrink-0">
        <div>
          <h2 className="font-semibold text-sm">{job.title}</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            {job.company}{job.location ? ` · ${job.location}` : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none ml-2 shrink-0"
        >
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-sm">
        {job.one_line_pitch && (
          <div className="bg-gray-800 rounded-lg p-3 border-l-2 border-blue-500">
            <p className="text-gray-300 italic text-xs leading-relaxed">{job.one_line_pitch}</p>
          </div>
        )}

        {job.strengths?.length > 0 && (
          <div>
            <h3 className="text-green-400 font-medium text-xs uppercase tracking-wide mb-2">
              ✓ Strengths / 优势
            </h3>
            <ul className="space-y-2">
              {job.strengths.map((s, i) => (
                <li key={i} className="text-gray-300 text-xs flex gap-2">
                  <span className="text-green-500 mt-0.5 shrink-0">•</span>
                  <span><BilingualText text={s} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {job.gaps?.length > 0 && (
          <div>
            <h3 className="text-red-400 font-medium text-xs uppercase tracking-wide mb-2">
              ✗ Gaps / 不足
            </h3>
            <ul className="space-y-2">
              {job.gaps.map((g, i) => (
                <li key={i} className="text-gray-300 text-xs flex gap-2">
                  <span className="text-red-500 mt-0.5 shrink-0">•</span>
                  <span><BilingualText text={g} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {job.key_requirements?.length > 0 && (
          <div>
            <h3 className="text-orange-400 font-medium text-xs uppercase tracking-wide mb-2">
              Key Requirements / 岗位要求
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {job.key_requirements.map((r, i) => (
                <span
                  key={i}
                  className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded leading-snug"
                >
                  <BilingualText text={r} />
                </span>
              ))}
            </div>
          </div>
        )}

        {job.noc_code && (
          <div>
            <h3 className="text-purple-400 font-medium text-xs uppercase tracking-wide mb-2">
              NOC Classification / 职业分类
            </h3>
            <div className="bg-gray-800 rounded-lg p-3 space-y-1">
              <p className="text-gray-200 text-xs font-medium">NOC {job.noc_code}</p>
              {job.noc_explanation && (
                <p className="text-gray-400 text-xs leading-relaxed">{job.noc_explanation}</p>
              )}
            </div>
          </div>
        )}

        {!job.match_score && (
          <p className="text-gray-600 text-xs italic">Analysis pending...</p>
        )}
      </div>

      {/* Fixed footer — always visible */}
      {job.apply_url && (
        <div className="p-4 border-t border-gray-800 shrink-0">
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Apply →
          </a>
        </div>
      )}
    </div>
  );
}
