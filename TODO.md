# TODO / Known follow-ups

Tracked items deferred from earlier work. Remove an entry once it's resolved.

## 1. `switchTrack` stale-guard bypass in the custom-search tab

The custom-search results tab button (`client/src/App.jsx`, the `{customTab && (…)}`
block in the track tabs) calls `setActiveTrack(customTab.id)` directly instead of
going through `switchTrack()`. That skips the `activeTrackRef` stale-fetch guard
(added in v3.1.5), which discards a previous tab's in-flight `loadJobs` response
before calling `setJobs`. Result: a late response from the prior track could
briefly populate the `search:<slug>` tab's list.

Fix: route the custom-tab click through `switchTrack` (or set `activeTrackRef.current`
when activating a custom tab) so the guard applies. Low severity.

## 2. Stale tests out of sync with current API shapes

These two suites have been red since before the v4.0 work and test behavior that
no longer exists. They should be updated, not deleted:

- `tests/scraper.test.js` — expects `scrape('it-support')` to *return* a jobs array.
  `scrape(trackId, onJob)` switched to a callback pattern in v2.0 (commit d25a561)
  and returns `undefined`. Rewrite the assertions to collect jobs via the `onJob`
  callback.
- `tests/routes/tracks.test.js` — expects every track to have `label` and `queries`.
  `GET /api/tracks` returns DB-backed tracks (`id`, `name`, `emoji`, no `queries`)
  since the v3.1 DB-track migration. Update the expected shape.
