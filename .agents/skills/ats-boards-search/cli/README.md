# ats-boards-cli

CLI for searching job postings across mid/small fintech, capital-markets, and adjacent
companies' own **Greenhouse**, **Lever**, and **Ashby** career boards — the companies
that post only on their own site and never surface via LinkedIn/eFinancialCareers search.

**Data source**: the public JSON APIs behind Greenhouse (`boards-api.greenhouse.io`),
Lever (`api.lever.co`), and Ashby (`api.ashbyhq.com/posting-api`) — the same feeds each
company's own careers page fetches to render its job list.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.
**Company list**: `../companies.json` — a curated registry, not an auto-discovered crawl.

## Installation

```bash
cd .agents/skills/ats-boards-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search across the registry (or one `--company`/`--ats`) |
| `detail` | Full, decoded description for one posting (pass its URL) |
| `list-companies` | Dump the curated company registry |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# CTO roles across the whole registry
bun run src/cli.ts search -q "chief technology officer" --format table

# Everything open at one company
bun run src/cli.ts search --company kalshi --format table

# Full detail for one posting
bun run src/cli.ts detail "https://job-boards.greenhouse.io/kalshi/jobs/7626709003" --format plain
```

See `../SKILL.md` for the full flag reference and `../url-reference.md` for the three
ATS APIs' endpoint shapes and how to add a new company to the registry.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords, matched against the job **title only**. |
| `--company` | | Scope to one company (slug from `companies.json`). |
| `--ats` | | Scope to one ATS: `greenhouse` \| `lever` \| `ashby`. |
| `--location` | `-l` | Client-side substring filter on the location field. |
| `--jobage` | | Posted within N days. |
| `--page` | | 1-indexed page over the merged, sorted results (25/page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
