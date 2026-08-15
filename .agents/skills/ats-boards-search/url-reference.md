# ATS Boards API Reference

Public, unauthenticated JSON APIs behind three ATS platforms that most funded
startups and mid-size scale-ups use for their own careers page, rather than a big
aggregator (LinkedIn, eFinancialCareers). Each API is the vendor's own public data
feed — no scraping, no ToS gray area, no personal-use warning needed.

Each endpoint returns **that one company's full job list** in a single call — none of
the three support server-side keyword search or pagination. This CLI fetches
per-company (from `companies.json`) and does keyword/location/recency filtering,
sorting, and pagination client-side.

## Greenhouse

```
GET https://boards-api.greenhouse.io/v1/boards/<slug>/jobs
GET https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true
```

- `<slug>` is visible in the company's careers URL: `boards.greenhouse.io/<slug>` or
  `job-boards.greenhouse.io/<slug>` (both host names are used in the wild for the same
  API — try both when investigating a new company).
- Without `content=true`: lightweight list — `id`, `title`, `location.name`,
  `updated_at`, `first_published`, `absolute_url`. With it: adds `content`, the full
  job description as **HTML with its own tags entity-encoded** (e.g. `&lt;div&gt;`) —
  decode entities once, then strip tags.
- Invalid slug → HTTP 404, body `{"status":404,"error":"Job not found"}`.
- Detail URL shape: `https://<host>/<slug>/jobs/<id>` — `<id>` is numeric.

## Lever

```
GET https://api.lever.co/v0/postings/<slug>?mode=json
```

- `<slug>` is visible in `jobs.lever.co/<slug>`.
- Returns a **bare JSON array** (not wrapped in an object) — full posting including
  description every time, no separate detail call needed. Key fields: `id` (UUID),
  `text` (title), `categories.location`, `categories.team`, `categories.commitment`,
  `createdAt` (epoch ms), `descriptionPlain`, `hostedUrl`.
- Invalid slug → HTTP 404, body `{"ok":false,"error":"Document not found"}`.
- Valid slug with zero current openings → HTTP 200, body `[]`. Don't treat this as an
  error — many boards legitimately sit empty between hiring pushes.
- Detail URL shape: `https://jobs.lever.co/<slug>/<id>`.

## Ashby

```
GET https://api.ashbyhq.com/posting-api/job-board/<slug>
```

- `<slug>` is visible in `jobs.ashbyhq.com/<slug>` — **case-sensitive** (e.g. Talos
  Trading's slug is `Talos-Trading`, not `talos-trading`).
- Returns `{"jobs": [...]}`. Full description included every time as `descriptionHtml`
  and `descriptionPlain`. Key fields: `id` (UUID), `title`, `location`, `department`,
  `team`, `employmentType`, `publishedAt`, `isRemote`, `workplaceType`, `jobUrl`.
- Invalid slug → HTTP 404, **plain-text** body (`Not Found`), not JSON — the CLI's
  `jsonFetch` tolerates a non-JSON body and treats it as "no jobs" rather than crashing.
- Detail URL shape: `https://jobs.ashbyhq.com/<slug>/<id>`.

## Adding a new company to the registry

1. Find the company's careers page and identify which of the three ATS platforms it
   redirects to (view page source for `boards-api.greenhouse.io`, `api.lever.co`, or
   `api.ashbyhq.com`, or just try the careers URL pattern each ATS uses).
2. Hit the endpoint directly (`curl` or WebFetch) and confirm it returns HTTP 200 with
   a `jobs` array (Greenhouse/Ashby) or a bare array (Lever) — **never guess a slug
   without confirming the live response**, a wrong slug silently returns zero jobs
   forever rather than erroring loudly in `/scrape`.
3. Add an entry to `companies.json`: `name`, `sector`, `ats`, `slug`, `careers_url`,
   and an optional `notes` field for anything unusual (unexpected slug, low posting
   volume, etc. — see existing entries for the pattern).
4. Re-run `bun run cli/src/cli.ts search --company <slug> --format table` to confirm
   it returns real results before committing.

## Notes

- No credentials, no rate-limit trouble observed in practice — these are the vendors'
  own public product surface, not a scraped page, but the CLI still backs off on
  429/5xx like every other portal skill in this repo.
- `companies.json` is a curated allowlist, not an auto-discovered crawl — coverage is
  only as good as what's been added. Re-run the research pass periodically (or after
  `/scrape`'s "known-portal" coverage stops finding anything new) to catch companies
  that switched ATS or newly adopted one of the three.
