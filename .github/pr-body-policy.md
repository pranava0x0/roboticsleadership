Automated policy scrape (Federal Register) — pending curator review.

Federal Register returns broad keyword matches; many entries here will not actually be robotics-relevant. Curator pass before merge:

- [ ] **Delete records that aren't actually robotics-relevant.** This is the most important step — most auto-scraped Federal Register hits are noise.
- [ ] Refine `robotics_scope` from the placeholder "Federal Register — robotics-related".
- [ ] Set `status` correctly (`In effect` vs `Introduced`) based on document type.
- [ ] Populate `beneficiaries[]` and any state-specific fields.
- [ ] Remove the `_requires_curator_review` and `_scraped` flags once reviewed.

Merging this PR triggers the Pages deploy automatically.
