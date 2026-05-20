export default function TrackTabs({ tracks, activeTrack, onSelect, onRefresh, onAnalyze, isRefreshing }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-800 px-6">
      {tracks.map(track => (
        <button
          key={track.id}
          onClick={() => onSelect(track.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTrack === track.id
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>{track.emoji}</span>
          <span>{track.label}</span>
        </button>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onAnalyze}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>⚡</span>
          <span>{isRefreshing ? 'Analyzing...' : 'Analyze'}</span>
        </button>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className={isRefreshing ? 'animate-spin inline-block' : ''}>↻</span>
          <span>{isRefreshing ? 'Scraping...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}
