---
name: ats-boards-search
version: 1.0.0
description: >
  Searches job postings directly from mid/small fintech, capital-markets, and adjacent
  companies' own careers pages (Greenhouse, Lever, Ashby) - the roles that never surface
  on LinkedIn or eFinancialCareers because the company posts only on its own site. Use
  for finding jobs at trading firms, market makers, payments/lending fintechs, wealthtech,
  RegTech, CRE SaaS, and healthcare-analytics companies below big-cap size. Trigger
  phrases: find jobs at smaller companies, fintech startups hiring, company career pages,
  Greenhouse jobs, Lever jobs, Ashby jobs, ATS boards, mid-size fintech jobs, boutique
  trading firm jobs.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/ats-boards-search/cli/src/cli.ts *)
---

# ATS Boards Search Skill

Searches job postings across a **curated registry** of mid/small fintech, capital-markets,
and adjacent companies (`companies.json`) by querying the public JSON APIs behind three
ATS platforms directly: **Greenhouse**, **Lever**, and **Ashby**. No authentication, no
API key, and **zero runtime dependencies** — it runs with just `bun`.

Unlike the other portal skills in this repo, this isn't one job board — it's an
aggregator over ~55 individual companies' own career-page data feeds, which is exactly
the coverage gap big aggregators leave: a company that posts only on its own site never
shows up in a LinkedIn search no matter how good the query.

## Why this exists

These are the ATS vendors' own public product surface (the same JSON the company's
careers page fetches client-side to render job cards) — not a scraped HTML page, so
there's no Terms-of-Service gray area and no personal-use warning needed.

## When to use this skill

- Broad sweep across all registered companies for a role/title (e.g. "chief technology
  officer", "head of data")
- Scoped to one ATS platform (`--ats greenhouse`) or one company (`--company kalshi`)
- Full detail (readable, decoded description) for a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/ats-boards-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords, matched against the **job title only**
  (title-only on purpose — matching against full descriptions passes almost any
  senior-role posting, since long descriptions tend to contain most query words
  somewhere regardless of the role's actual title).
- `--company <slug>` — scope to one company (slug from `companies.json`).
- `--ats <ats>` — scope to one ATS: `greenhouse` | `lever` | `ashby`.
- `--location <text>` / `-l <text>` — client-side substring filter on the location field.
- `--jobage <days>` — posted within N days. Jobs with an undetermined date are never
  filtered out (can't evaluate the cutoff, so they're kept rather than silently dropped).
- `--page <n>` — 1-indexed page over the merged, sorted results (25/page — there is no
  server-side pagination across these APIs, each call returns one company's full list).
- `--limit <n>` / `-n <n>` — cap results emitted (client-side, applied after paging).
- `--format json|table|plain` — default `json`.

A full-registry sweep (no `--company`) fetches every company's lightweight listing (no
descriptions) for speed; scoping to `--company` fetches with full descriptions included.

### Fetch full job detail

```bash
bun run .agents/skills/ats-boards-search/cli/src/cli.ts detail <url> [--format json|plain]
```

Pass the posting's URL directly (from a `search` result's `url` field) — it's
self-sufficient, no other flags needed. A bare id also works with `--company <slug>`
(and `--ats` if that company isn't in the registry).

### List the company registry

```bash
bun run .agents/skills/ats-boards-search/cli/src/cli.ts list-companies [--format json|table]
```

## Usage examples

```bash
# CTO / Head of Technology roles across every registered company
bun run .agents/skills/ats-boards-search/cli/src/cli.ts search -q "chief technology officer" --format table

# Head of Data roles, Greenhouse-hosted companies only, last 14 days
bun run .agents/skills/ats-boards-search/cli/src/cli.ts search -q "head of data" --ats greenhouse --jobage 14 --format table

# Everything currently open at one company
bun run .agents/skills/ats-boards-search/cli/src/cli.ts search --company ramp --format table

# Full detail for one posting
bun run .agents/skills/ats-boards-search/cli/src/cli.ts detail "https://job-boards.greenhouse.io/kalshi/jobs/7626709003" --format plain

# See what's in the registry
bun run .agents/skills/ats-boards-search/cli/src/cli.ts list-companies --format table
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing URLs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- `companies.json` is a curated allowlist compiled 2026-08-13 (~55 companies spanning
  trading infrastructure, capital-markets fintech, digital-asset trading, payments,
  RegTech, wealthtech, CRE SaaS, and healthcare analytics), not an auto-discovered
  crawl — see `url-reference.md` for how to verify and add new companies.
- Query matching is a simple client-side title filter, not a real search index — it's
  triage-grade, matching this repo's `/scrape` → `/rank` → `/apply` pipeline where depth
  comes later, not at discovery time.
- A company whose board legitimately has zero current openings returns an empty result,
  not an error — don't read "0 results for --company X" as the integration being broken.
- **Change-detection cache.** Each company's job roster is cached on disk for an hour, so
  running several title queries back to back (a typical `/scrape` sweep) fetches each
  board once instead of once per query. For Greenhouse companies specifically, a
  `--company` full-description fetch is skipped entirely whenever that company's roster
  (ids/titles/locations/dates) hasn't changed since the last time descriptions were
  fetched — a board with no postings added, removed, or moved never re-downloads
  descriptions it already has. The cache lives at `cli/.cache/board-cache.json`
  (gitignored, local runtime state) and self-heals if deleted or corrupted. It is a
  change-*detection* cache, not a content-diff: an in-place edit to an existing
  posting's body text (e.g. a salary tweak) with no id/title/location/date change won't
  be caught until something else on that board shifts.
