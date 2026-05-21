const pausedTracks = new Set();

module.exports = {
  pause:    (track) => pausedTracks.add(track),
  resume:   (track) => pausedTracks.delete(track),
  isPaused: (track) => pausedTracks.has(track),
};
