Automated policy scrape (Federal Register) — pending curator review.

Federal Register returns broad keyword matches; many entries here will not actually be robotics-relevant. Each new record is auto-tagged `_requires_curator_review: true`.

> ⚠️ **Merging this without clearing the flags will fail the Pages deploy.**
> `validate.js` rejects `_requires_curator_review` at publish time, so the site
> will stop updating until the records are curated or dropped. That's the point:
> the flag is what makes uncurated data unshippable. Curate here, not after it's
> live. A 2026-07 sweep dropped **78 of 88** flagged policy records as noise —
> assume most of this PR is noise too, and delete rather than keep.

Curator pass before merge:

- [ ] **Delete records that aren't actually robotics-relevant.** The most important step, and usually most of them: drug-scheduling notices, housing loans, Nasdaq filings.
- [ ] **But read before deleting.** Relevance here is a judgement call, not a keyword match — the Entity List addition of 32 Chinese entities and the Section 301 excess-capacity investigation both contain no robotics keyword and are both core to the thesis, while "Automated Commercial Environment" is a customs IT system.
- [ ] Refine `robotics_scope` from the placeholder "Federal Register publication" — it's boilerplate on every scraped record, so it is never a relevance signal.
- [ ] Set `status` correctly (`In effect` vs `Introduced`) based on document type.
- [ ] Populate `beneficiaries[]` and any state-specific fields.
- [ ] Remove the `_requires_curator_review` flag once reviewed — this is what releases the record to the site.
