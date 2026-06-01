# Security & supply-chain log

> Refresh this file (and re-fetch <https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt>) if `Last updated` below is more than 7 days old, before any `npm install` / `pip install` / dep upgrade.

**Last updated:** 2026-05-22

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
| 2026-05-22   | <https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt>      | Checked for recent active vulnerabilities (node-ipc, Mini Shai-Hulud). Project remains at zero dependencies and is not affected. |
| 2026-06-01   | <https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt>      | Swept ahead of the Actions SHA-pinning work. **Megalodon** (critical, disclosed 2026-05-22) — mass GitHub-Actions workflow poisoning of 5,561 repos via stolen GitHub creds + injected workflows exfiltrating CI secrets to `216.126.225.129:8443`. Directly relevant: our 3 cron jobs hold `contents:write`+`pull-requests:write`. Mitigation applied — all actions pinned to commit SHAs, least-privilege `permissions:` confirmed on every workflow. No repo IOCs (no unexpected workflow commits; no `216.126.225.129` references). Cargo CVE-2026-5223/5222 and Composio breach reviewed — not applicable (no Rust, no Composio). Still zero runtime dependencies. |
