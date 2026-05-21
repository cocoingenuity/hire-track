const pausedTracks = new Set();
const stoppedTracks = new Set();

module.exports = {
  pause:     (track) => pausedTracks.add(track),
  stop:      (track) => stoppedTracks.add(track),
  resume:    (track) => { pausedTracks.delete(track); stoppedTracks.delete(track); },
  isPaused:  (track) => pausedTracks.has(track),
  isStopped: (track) => stoppedTracks.has(track),
};
