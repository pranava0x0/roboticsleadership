# Security & supply-chain log

> Refresh this file (and re-fetch <https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt>) if `Last updated` below is more than 7 days old, before any `npm install` / `pip install` / dep upgrade.

**Last updated:** 2026-05-17

---

## Current dependency surface

**None.** This project ships zero runtime dependencies — vanilla HTML / CSS / JS in `docs/`, plain Node `fetch` in `scripts/` (Node 18+ built-in).

If we ever add a runtime dep, document the reason here, the advisory check date, and the pinned version. The folder default is "don't add a dep you can't maintain alone."

---

## Allowed network egress

| Destination                         | Purpose                                  |
| ----------------------------------- | ---------------------------------------- |
| `api.congress.gov`                  | Federal bill metadata + text (deferred — needs API key) |
| `www.federalregister.gov`           | Federal rule RSS + search API            |
| `spectrum.ieee.org`                 | IEEE Spectrum robotics RSS               |
| `techcrunch.com`                    | TechCrunch tag RSS                       |
| `www.reddit.com`                    | Subreddit JSON endpoints (no auth)       |

All scrapers honor `robots.txt`, throttle ≥1.5s between requests to the same host, and identify themselves with a `User-Agent` naming this project + a contact URL.

---

## Credentials handling

- No API keys committed. Read from env vars; halt with a clear error if missing.
- Never log or print key values.
- `.gitignore` covers: `.env`, `.env.local`, `credentials.json`, `secrets/`, `__pycache__/`, `dist/`.
- Pre-commit grep: `git diff --cached | grep -iE "apikey|password|token|secret"` before pushing.

---

## Privacy

This site collects nothing client-side: no analytics, no cookies, no tracking pixels, no Google Tag Manager. If we add analytics later, document the choice here and prefer a server-side / privacy-preserving option (Plausible, simple-analytics) over GA. Never proxy a tracking SDK through our own domain to bypass blockers.

---

## Advisory sweeps

| Date         | Source                                                                 | Result                                                |
| ------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| 2026-05-17   | <https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt>      | Pending check (no installs to gate this build).      |
