# Policy and regulatory ideas from the 2026-11-20 sweep (window 2026-11-17 to 2026-11-20)

Everything below was read from the Federal Register API, regulations.gov, or a named page unless marked "lead".

## A. Fixes to records already on the site

1. `nhtsa-fmvss-108-ads-lighting-nprm-2026` says "Comments are due November 25, 2026". NHTSA's Nov 16 notice (91 FR 73504) extends the period to **December 10, 2026**. The extension is 15 days, requested by the Alliance for Automotive Innovation, SAE International and Gatik.
   https://www.federalregister.gov/documents/2026/11/16/2026-23239/federal-motor-vehicle-safety-standards-modernization-of-fmvss-no-108-to-accommodate-ads-equipped
2. `fedreg-2026-23529` (Commerce remote-access chip rule) says "comments are due 60 days later" and links the public-inspection copy. It was published Nov 19 at 91 FR 74970, took effect Nov 19, and comments close **January 19, 2027** (docket 261116-0005). Swap the source to the published document.
   https://www.federalregister.gov/documents/2026/11/19/2026-23529/addressing-remote-access-to-advanced-semiconductors
3. `proc-2026-10-28-robotics-232` still says "Not yet published in the Federal Register as of October 29". It ran Nov 2 as Proclamation 11077, 91 FR 69199. `docs/section-232-robotics.html` already has the citation; only the policies.json summary is stale.
   https://www.federalregister.gov/documents/2026/11/02/2026-22385/adjusting-imports-of-robotics-industrial-machinery-and-their-parts-and-components-into-the-united
4. `fedreg-2026-19704` (FDA robotically-assisted surgical devices draft guidance) is correct that comments close **Nov 24**; flag it as four days out.

## B. Dated items in the next 60 days (to Jan 19, 2027)

| Date | Item | Status on site |
|---|---|---|
| Nov 20 | UN weapons conference (CCW review) scheduled to close; decides whether to open talks on autonomous weapons. NGOs say Russia and the US are snagging the talks (AFP via Yahoo, Nov 18) | opening tracked 11-16; outcome not found yet, check Nov 20-21 |
| Nov 24 | FDA draft guidance on robotic surgical devices, comments close (docket FDA-2026-N-9505) | tracked |
| Nov 25 | XPeng AI Day, Guangzhou, with new IRON capabilities promised (calendar item, not policy) | not tracked |
| Dec 3 / Dec 10 | Senate Banking hearings: Jensen Huang requested Dec 3, Commerce Secretary Lutnick Dec 10 | tracked 11-14 |
| Dec 5 | China MIIT robot identification code draft (GB/T 48541-2026), comments close | tracked 11-05 |
| Dec 7 | Statutory deadline for the FAA's drone beyond-visual-line-of-sight final rule (Part 108); at the White House regulatory office since July 10, FAA gives no date | in sweep.json (single trade-press source) |
| Dec 10 | NHTSA FMVSS 108 driverless-vehicle lighting comments close | record needs the new date |
| about Dec 21 | Census Annual Integrated Economic Survey revision, 30-day OMB comment period from Nov 20 (control no. 0607-1024) | in sweep.json |
| Jan 9, 2027 | USTR Section 301 exclusions expire | tracked 11-10 |
| Jan 10, 2027 | Commerce 50% Affiliates Rule pause ends; China's rare-earth export-control pause ends | tracked 11-05, 11-09 |
| Jan 15, 2027 | NHTSA information collection on Part 555 exemptions from safety standards, comments close (FR 2026-23238) | not tracked; the exemption route Cybercab-type vehicles would use |
| Jan 19, 2027 | Commerce remote-access chip rule comments close | see A.2 |
| Apr 26, 2027 | Section 232 robotics negotiations, 180-day update due | tracked |

## C. Reframing ideas

1. **The compute gate and the robot stack, as one timeline.** Four items from this month sit on one thread: the remote-access rule (effective Nov 19), NVIDIA halting H200 shipments to China, the House Foreign Affairs release of licence data (3.4 million chips requested and more than 879,000 approved, per the committee; press tallies add 21 licences covering Dec 2025 to May 2026), and NVIDIA's call remark that physical-AI revenue should pass $25B this fiscal year. The site's rule text note already says the rule does not mention robots; the argument is that robot foundation models train on this compute. Sources: A.2 above; https://foreignaffairs.house.gov/news/press-releases/chairman-brian-mast-exercises-legislative-authority-to-publicly-release-ai-chip-license-information-for-china
2. **The FCC as the de facto robotics gatekeeper.** The site tracks the robot Covered List, the conditional approvals and the test-lab order. On Nov 19 the FCC also adopted the drone-spectrum order (450 MHz data links, 24.45-24.65 GHz counter-drone radar; GN Docket 26-74). A single page listing every FCC robot and drone action with dates would show one agency setting terms for both Chinese-made robots and US drones. Agenda: https://www.federalregister.gov/documents/2026/11/18/2026-23467/sunshine-act-open-commission-meeting-thursday-november-19-2026
3. **Robotaxi rules are being rewritten one safety standard at a time.** NHTSA's FMVSS modernization proposals now cover Nos. 102, 103/104, 108 and 110 (all tracked as separate FR records), plus the Part 555 exemption collection (comments Jan 15). The Cybercab case shows the gap: AutoGuide reports NHTSA told Tesla to show under oath that a car with no brake pedal complies, and Tesla answered on Oct 30 and asked that the answer stay confidential; NHTSA has not ruled. Group these as "what has to change for a car with no driver" instead of four separate rows.
4. **Measurement as policy.** The Census Bureau is adding the standard robotics questions to manufacturers' versions of its annual survey (FR 2026-23717), NIST has a humanoid benchmark in development (tracked), and Artificial Analysis now runs an independent robot-arm test of frontier language models. The site's US adoption numbers come from A3 and IFR; the angle is that official US statistics on robot use are only now being extended to manufacturing. Source: https://www.federalregister.gov/documents/2026/11/20/2026-23717/agency-information-collection-activities-submission-to-the-office-of-management-and-budget-omb-for
5. **Drones: spectrum done, airspace rule late.** The FCC order lands the same week FAA officials told AUVSI they have no date for Part 108, with the statutory deadline Dec 7. The Section 232 drone tariff (Aug) is already tracked. A short "what a US drone operator can do today versus after Part 108" explainer fits the site's drone coverage. Source: https://uavcoach.com/faa-utm-flights-part-108-update/
6. **Procurement bans meet a Trump-family-linked humanoid maker.** The tracked bills (Humanoid ROBOT Act, GUARD Act, American Security Robotics Act, FY2027 NDAA Sec. 163) all aim at adversary-made robots. This week Reuters reported South Korea's Base Group preparing a $150M investment in Foundation, whose adviser is Eric Trump, and Democratic senators have already questioned a $2M Base payment to the Trump Organisation. That is a US-side governance question the site has not covered: who funds the domestic alternative. Source: https://www.businessday.co.za/world/international-companies/2026-11-19-trump-family-linked-robot-maker-banks-on-150m-south-korean-lifeline/
7. **China's demand-side policy.** At its Nov 19 press conference MOFCOM said the consumer trade-in policy is speeding smart upgrades and that its data show fast sales growth for smart new products including embodied-AI robots; it gave no figures. Combined with the MIIT five-standard release (11-16), the 55 farm-robot scenarios (11-19) and the robot ID code draft, China's policy toolkit reads as standards plus scenario lists plus consumer demand support. Source: https://www.yicai.com/brief/103446656.html
8. **Autonomous-weapons governance.** The CCW conference closes Nov 20 with the US backing a five-year non-binding track and NGOs saying the US and Russia are blocking binding talks. Foundation's CEO told Fast Company he is "not anti-weaponization and warfare" on Nov 18. Worth a single explainer once the outcome is known.

## D. Searched, nothing found

- Open robotics RFIs: none. Federal Register searches since Nov 16 for robot, robotics, humanoid, unmanned, autonomous vehicle, Section 232, Entity List, request for information and NIST returned only the items above. regulations.gov (DEMO_KEY, documents since Nov 1) showed only filings in Aurora's FMCSA docket FMCSA-2026-0958, already tracked.
- New executive orders on robotics: none found.
- USTR press page: Nov 18-19 items unrelated. NIST news: nothing on robotics Nov 19. bis.gov press page returned 404 and war.gov returned 403.
- Reddit r/robotics: JSON 403, RSS 404, search RSS 429, retried once with a different path. Skipped.
- Congress.gov was not queried.

## E. Leads not verified (do not publish without reading the source)

- Bloomberg Law via Yahoo Finance, Nov 19: "US Lawmakers Near Deal to Ban Chinese Cars in Lame Duck Session" (with a Mercedes carve-out). Paywalled; connected-vehicle angle.
- CNBC via MSN, Nov 17: Huang scandal fuels a bipartisan push to block AI chip sales to China. MSN text not readable.
- VW and May Mobility: ID. Buzz robotaxi, 10,000 vehicles by 2031 (Nov 13-14 reports; the Future Transport page was blocked).
- Washington, D.C. robotaxi bill died on a 3-3 committee vote (shattered.io, Nov 17); Denver says state law blocks it from regulating Waymo (Denver7, Nov 18).
- Army "manufacturing rodeo" for small drones (Breaking Defense, Nov 17) and a Navy order for 82 more HII Lionfish undersea vehicles (Nov 17). Not opened.
- KED Global page for the Hanwha-Raion story lists LIG Nex1 buying 60% of Philadelphia's Ghost Robotics for $240M; no date visible.
