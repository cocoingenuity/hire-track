# TODO / Known follow-ups

Tracked items deferred from earlier work. Remove an entry once it's resolved.

## 1. Stale tests out of sync with current API shapes

These two suites have been red since before the v4.0 work and test behavior that
no longer exists. They should be updated, not deleted:

- `tests/scraper.test.js` — expects `scrape('it-support')` to *return* a jobs array.
  `scrape(trackId, onJob)` switched to a callback pattern in v2.0 (commit d25a561)
  and returns `undefined`. Rewrite the assertions to collect jobs via the `onJob`
  callback.
- `tests/routes/tracks.test.js` — expects every track to have `label` and `queries`.
  `GET /api/tracks` returns DB-backed tracks (`id`, `name`, `emoji`, no `queries`)
  since the v3.1 DB-track migration. Update the expected shape.
