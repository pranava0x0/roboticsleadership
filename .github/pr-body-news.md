Automated news scrape — pending curator review.

Each new record is auto-tagged `_requires_curator_review: true`.

> ⚠️ **Merging this without clearing the flags will fail the Pages deploy.**
> `validate.js` rejects `_requires_curator_review` at publish time, so the site
> will stop updating until the records are curated or dropped. That's the point:
> the flag is what makes uncurated data unshippable rather than merely
> discouraged. Curate here, not after it's live.

Curator pass before merge:

- [ ] Remove any records that aren't actually robotics-relevant.
- [ ] Tag `companies[]`, `policies[]`, `themes[]` where applicable.
- [ ] Set `sentiment` (currently `Neutral`).
- [ ] Confirm or refine the auto-assigned `category` — it's keyword-derived and
      regularly wrong (a 2026-07 sweep recategorised 10 of 20, including a
      Section 232 robotics import investigation filed under `Funding`).
- [ ] Remove the `_requires_curator_review` flag once reviewed — this is what
      releases the record to the site.
