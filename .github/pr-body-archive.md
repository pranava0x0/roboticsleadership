Monthly Wayback Machine refresh — adds `archive_url` to source URLs that didn't have a snapshot recorded yet.

This PR is fully mechanical:

- No human-authored text changes
- Only `archive_url` fields added next to existing source URLs
- Any `sources[]` arrays that still held bare URL strings have been migrated to `{ url, archive_url? }` objects

Curator pass before merge (light):

- [ ] Skim the diff for any URLs that resolved to obviously wrong snapshots (rare — Wayback's availability API returns the closest snapshot regardless of date).
- [ ] If a URL has no `archive_url` after this run, manually trigger Save Page Now (`node scripts/archive-sources.js --save-missing --file=<file>`) or accept the gap for now.

Merging this PR triggers the Pages deploy automatically.
