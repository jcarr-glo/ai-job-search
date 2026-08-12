---
name: efinancialcareers-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs specifically in financial
  services, banking, capital markets, or fintech — on eFinancialCareers, a niche board
  covering roles across major global finance hubs (New York, London, Hong Kong,
  Singapore, Frankfurt, and more) and remote. Invoke for banking jobs, finance jobs,
  capital markets roles, trading jobs, fintech jobs, risk/compliance roles, and
  technology-in-finance roles (e.g. "Head of Technology" at a bank or asset manager).
  Trigger phrases: efinancialcareers, finance jobs, banking jobs, capital markets jobs,
  fintech jobs, trading jobs, investment banking jobs, quant jobs, risk management jobs,
  compliance jobs, financial services careers.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts *)
---

# eFinancialCareers Search Skill

Search live job listings from **eFinancialCareers**, a niche job board dedicated to
financial services and capital markets careers (banking, trading, risk, compliance,
fintech, and technology-in-finance roles) across major global finance hubs and remote.
No authentication required to view listings, and **zero runtime dependencies** — it runs
with just `bun`.

## ⚠️ Personal use only

This uses eFinancialCareers' public job pages. `robots.txt` does **not** disallow the
`/jobs` search and detail paths this skill fetches, and no login is required to view
listings — but eFinancialCareers' **Terms & Conditions explicitly prohibit** the use of
bots, spiders, or other automated tools to navigate, search, or "data mine" the site.
That restriction applies regardless of what `robots.txt` allows. **Keep volume low, do
not use this commercially or for bulk data collection, and run it on your own
responsibility** — the same posture this repo already takes with `linkedin-search`.

## When to use this skill

- Search for financial-services / capital-markets job openings by keyword and location
- Get the full description, salary range, employment type, and application deadline of
  a specific job listing

## Commands

### Search job listings

```bash
bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts search --query "<text>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — **required.** Keywords (job title, skill, or role), e.g. `"Head of Technology"`.
- `--location <text>` / `-l <text>` — location filter, e.g. `"United States"`, `"New York"`, `"London"`. Optional; omit to search globally.
- `--jobage <days>` — posted within N days. Applied **client-side** against each result's approximate posting age — the portal has no working server-side date filter on this route, and this only filters the results already on the fetched page (see Notes).
- `--page <n>` — page number (1-indexed, 20 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric job ID from `search` results (e.g. `24528700`). You may also pass a
full eFinancialCareers job URL. Returns the full description, salary range, employment
type, application deadline, and listed skills.

## Usage examples

```bash
# Head of Technology roles, USA
bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts search -q "Head of Technology" -l "United States" --format table

# Quantitative analyst roles in New York
bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts search -q "quantitative analyst" -l "New York" --format table

# Risk management roles in London
bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts search -q "risk manager" -l "London" --format table

# Fintech roles, no location filter (global)
bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts search -q "fintech product manager" --format table

# Roles posted in the last 7 days
bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts search -q "compliance officer" --jobage 7 --format table

# Full details for a specific job
bun run .agents/skills/efinancialcareers-search/cli/src/cli.ts detail 24528700 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Search works by URL path (`/jobs/<query-slug>`), not a `?keyword=` query param — the
  CLI builds this automatically from `--query`. `--location` is a real, server-respected
  query param on that route.
- `--jobage` has no working server-side equivalent on this portal, so it's a best-effort
  client-side filter over the current page's results only — it will not backfill by
  fetching additional pages, so a tight `--jobage` window can return fewer results than
  `--limit` even when older matches exist elsewhere.
- Page size is fixed at 20 results per page.
- Job IDs are numeric (e.g. `24528700`) — pass them as-is to `detail`.
- Detail pages carry a clean, structured `schema.org/JobPosting` block that the CLI
  parses directly (salary, employment type, deadline, skills, full description) — see
  `url-reference.md` for the field mapping.
- eFinancialCareers may rate-limit; the CLI retries 429/5xx with exponential backoff.
  Keep volume low regardless (see ToS note above).
