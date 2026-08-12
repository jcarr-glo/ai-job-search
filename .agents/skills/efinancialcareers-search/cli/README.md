# efinancialcareers-cli

CLI for searching jobs on **eFinancialCareers**, a niche job board for financial
services / capital markets careers (banking, trading, fintech, risk, compliance,
technology-in-finance) across major global finance hubs.

**Data source**: eFinancialCareers' public, server-side-rendered `/jobs/<slug>` search
pages and job detail pages (which embed a clean schema.org `JobPosting` JSON-LD block).
**Authentication**: None required to view listings.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **Personal use only.** eFinancialCareers' Terms & Conditions prohibit bots, spiders,
> and automated data mining of the site (`robots.txt` itself does not disallow the
> `/jobs` paths this CLI uses, and no login is required to view listings — but the ToS
> restriction applies regardless). Keep volume low, don't use it commercially or for
> bulk data collection, and run it on your own responsibility.

## Installation

```bash
cd .agents/skills/efinancialcareers-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings (`--query` required) |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Head of Technology roles, USA
bun run src/cli.ts search -q "Head of Technology" -l "United States" --format table

# Quant roles in New York
bun run src/cli.ts search -q "quantitative analyst" -l "New York" --format table

# Risk roles, last 7 days (client-side filtered — see Notes)
bun run src/cli.ts search -q "risk manager" --jobage 7 --format table

# Full detail for one job
bun run src/cli.ts detail 24528700 --format plain
```

See `../SKILL.md` for the full flag reference and the Terms-of-Service note.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | **Required.** Keywords (title / skill / role). |
| `--location` | `-l` | Location filter, e.g. `"United States"`, `"New York"`, `"London"`. |
| `--jobage` | | Posted within N days — filtered **client-side** on the fetched page only (see Notes). |
| `--page` | | 1-indexed page (20 results/page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Notes

- The search endpoint is `GET /jobs/<hyphen-joined-query>` — a real page route (SSR'd
  Angular), not a `?keyword=` query param (that param is silently ignored server-side).
  `--location` *is* a real, server-respected query param on that route.
- `--jobage` has no working server-side equivalent on this route, so it's applied
  client-side against each card's approximate relative posting age ("3 days ago" →
  parsed to an ISO timestamp). It only filters the results already on the fetched
  page — it does not scan additional pages to backfill the count.
- Detail pages carry a clean `schema.org/JobPosting` JSON-LD block (`datePosted`,
  `validThrough`, `baseSalary`, `employmentType`, full `description`, ...), which the
  CLI parses directly instead of scraping the rendered DOM — see `parseJobDetail` in
  `src/helpers.ts`.
