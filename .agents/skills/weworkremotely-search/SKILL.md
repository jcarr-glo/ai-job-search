---
name: weworkremotely-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for remote jobs on We Work
  Remotely, find remote job listings, or look up a specific We Work Remotely job
  posting — global, remote-first, any sector (software, design, devops, product,
  customer support, sales/marketing, management/finance, etc.). Trigger phrases:
  find a remote job, remote job search, search We Work Remotely, WWR jobs, remote
  job openings, remote vacancies, remote positions, "are there any remote X jobs",
  look up this We Work Remotely posting.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/weworkremotely-search/cli/src/cli.ts *)
---

# We Work Remotely Search Skill

Search live job listings from **[We Work Remotely](https://weworkremotely.com)** — a
global, remote-first job board covering software, design, devops, product,
customer support, sales/marketing, and management/finance roles. No authentication,
no API key, and **zero runtime dependencies** — it runs with just `bun`.

> This is a market-specific worked example of the repo's job-portal-skill pattern
> (generated via `/add-portal`), built on the same architecture as `linkedin-search`
> (zero-dependency, HTML-parsing based). We Work Remotely itself is global/remote-first,
> so there is no per-market configuration needed — the same skill works everywhere.

## When to use this skill

- Search for remote job openings by keyword, across any sector
- Filter by recency (posted in the last 24 hours / week / 2 weeks)
- Get the full description of a specific job listing

## Commands

### Search job listings

```bash
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
  **There is no separate location parameter** — WWR's search form only takes free
  text, so fold any region/country requirement into the query itself, e.g.
  `-q "engineering manager US only"` or `-q "support engineer EU timezone"`.
- `--jobage <days>` — posted within N days. WWR only offers three freshness
  buckets server-side (1, 7, 14 days); other values round up to the nearest
  bucket, and values above 14 are unfiltered ("Any Time").
- `--page <n>` — page number (1-indexed). WWR's search endpoint returns every
  match in a single response (it does not paginate server-side); this CLI slices
  the full result set client-side, 20 results per page.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side, applied
  after paging).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job slug from a `search` result (e.g. `lattice-engineering-manager-ai-1`
— WWR ids are slugs, not numbers). You may also pass a full
`https://weworkremotely.com/remote-jobs/...` URL. Returns the full description,
employment type, posting date, and validity window.

**`applyUrl` is always `null`.** WWR's public "Apply now" button redirects to
account sign-up; the real outbound apply link is only revealed to signed-in WWR
users and cannot be retrieved from the public page. Use the returned `url` (the
WWR listing page) to open the posting and apply manually.

## Usage examples

```bash
# Engineering management roles
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search -q "engineering manager" --limit 5 --format table

# Product design roles, posted in the last week
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search -q "product designer" --jobage 7 --format table

# Customer support roles, EU timezone folded into the query text
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search -q "customer support EU timezone" --format table

# DevOps roles, posted in the last 24 hours
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search -q "devops" --jobage 1 --format table

# Full details for a specific job
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts detail lattice-engineering-manager-ai-1 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from We Work Remotely's public search-results page and detail pages —
  no credentials required. `robots.txt` explicitly allows the `/remote-jobs/` and
  `/categories/` paths this skill reads (see `url-reference.md` for the full
  access check), and full posting descriptions are visible without an account —
  only the outbound apply-click is gated. No personal-use restriction applies.
- Job ids are portal-native slugs (e.g. `lattice-engineering-manager-ai-1`), not numeric.
- `location` in search results is the **company's** headquarters/timezone text
  (e.g. "San Francisco, California, USA"), not a distinct job-location field —
  WWR doesn't expose one separately from the free-text region tag
  (`employmentType`/`region` extra fields carry the "Full-Time"/"Anywhere in the
  World"-style category tags).
- WWR may rate-limit; the CLI retries 429/5xx with exponential backoff.
