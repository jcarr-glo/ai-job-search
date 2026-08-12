# weworkremotely-cli

CLI for searching jobs on **[We Work Remotely](https://weworkremotely.com)**, a
global remote-first job board, across any sector.

**Data source**: WWR's public `/remote-jobs/search` results page and `/remote-jobs/<slug>`
detail pages (server-rendered HTML; detail pages also embed a schema.org `JobPosting`
JSON-LD block, which this CLI parses for structured fields).
**Authentication**: None required to search or read a full posting description.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/weworkremotely-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Engineering management roles, table view
bun run src/cli.ts search -q "engineering manager" --limit 5 --format table

# Product design roles posted in the last week
bun run src/cli.ts search -q "product designer" --jobage 7 --format table

# Full detail for one job
bun run src/cli.ts detail lattice-engineering-manager-ai-1 --format plain
```

See `../SKILL.md` for the full flag reference and portal-specific notes.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). WWR has no separate location parameter — include a region in the query text if needed. |
| `--jobage` | | Posted within N days. Only 3 server-side buckets exist (1/7/14 days); other values round up, values above 14 are unfiltered. |
| `--page` | | 1-indexed page, sliced client-side (20/page) — WWR's search endpoint itself is unpaginated. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Known limitations

- **No location parameter.** WWR's search form only exposes a free-text `term` field; fold any region/country requirement into `--query`.
- **`applyUrl` is always `null`.** WWR's public "Apply now" button redirects to account sign-up (`/job-seekers/account/register`); the real outbound apply link is only revealed to signed-in users. Use the listing's own `url` to apply manually.
- **Job-age filtering is bucketed**, not arbitrary-day, unlike `linkedin-search`'s `f_TPR`.
