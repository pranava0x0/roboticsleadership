Automated news scrape — pending curator review.

Each new record is auto-tagged with `_requires_curator_review: true` and `_scraped: true`. Curator pass before merge:

- [ ] Remove any records that aren't actually robotics-relevant.
- [ ] Tag `companies[]`, `policies[]`, `themes[]` where applicable.
- [ ] Set `impact_tier` (currently `Medium` by default).
- [ ] Set `sentiment` (currently `Neutral`).
- [ ] Confirm or refine the auto-assigned `category`.
- [ ] Remove the `_requires_curator_review` and `_scraped` flags once reviewed.

Merging this PR triggers the Pages deploy automatically.
