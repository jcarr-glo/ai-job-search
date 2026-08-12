# eFinancialCareers URL Reference

Investigation performed live on 2026-08-12 against `https://www.efinancialcareers.com`.

> Personal use only — see the ⚠️ note in `SKILL.md`. eFinancialCareers' Terms & Conditions
> prohibit bots and automated data mining of the site; `robots.txt` does not disallow the
> paths documented here and no login is required to view listings, but the ToS restriction
> applies regardless. Keep volume low.

## robots.txt

```
User-agent: *
Disallow: /secure
Disallow: /myefc
Disallow: /login
Disallow: /rememberMobilePreference
Disallow: /remote
Disallow: /profile
Disallow: /v1
Disallow: /v3
Disallow: /search
...
User-agent: Googlebot-Jobs
Allow: /jobs/
Allow: /job-listings/
```

`/search` is disallowed for `User-agent: *`, but that is **not** the endpoint this skill
uses — see below. The `/jobs` and `/jobs/<slug>` paths this skill fetches are not disallowed
for `User-agent: *`, and are explicitly `Allow`ed for `Googlebot-Jobs`. `crawl-delay: 10` is
set; this skill's own request pacing (single request per command, exponential backoff on
429/5xx) stays well under that.

## Search

The site is an Angular Universal app — the initial HTTP response is already fully
server-side-rendered (no headless browser / JS execution needed), **but** the listing
content is driven entirely by the **URL path**, not by `?keyword=`-style query params.
`GET /jobs?keyword=...` silently ignores the `keyword` param and returns the same
default/unfiltered listing regardless of its value (confirmed: identical HTML for
`?keyword=Head+of+Technology` and `?keyword=zzzznonexistentquery`).

```
GET https://www.efinancialcareers.com/jobs/<slug>
```

- `<slug>` — the free-text query with words hyphen-joined and each word
  percent-encoded, e.g. `"Head of Technology"` → `Head-of-Technology`,
  `"C++ Developer"` → `C%2B%2B-Developer`. Confirmed live: a literal encoded space
  (`%20`) inside the slug causes a `502`; words must be hyphen-joined instead.
  Case-insensitive (`Head-Of-Technology` and `head-of-technology` return identical
  results).
- Zero-match slugs render `"No jobs found matching your search criteria."` in the HTML
  alongside a handful of unrelated "recommended jobs" cards — the parser must check for
  this marker and return `[]`, not treat those cards as matches (see `NO_RESULTS_MARKER`
  in `cli/src/helpers.ts`).

Query params (appended to the slug path):

| Param | Meaning | Example | Confirmed |
|-------|---------|---------|-----------|
| `location` | Free-text location filter, applied server-side | `location=United+States`, `location=New+York` | Yes — result count and page heading change accordingly |
| `page` | 1-indexed page (20 results/page) | `page=2` | Yes — distinct result set on page 2 |
| `postedDate` | Attempted "posted within" filter (facet exists: `ONE`/`THREE`/`SEVEN` = last 1/3/7 days) | `postedDate=SEVEN` | **No** — result count is unchanged from the unfiltered query for every value tried (`SEVEN`, `ONE`, `1`, `7`, case variants); the facet appears to be applied client-side only, not on this SSR route. The CLI does **not** send this param — instead it applies `--jobage` as a client-side post-filter using each card's parsed relative-age text. |
| `sortBy` | Sort order (default `relevance` per an embedded config blob) | `sortBy=date` | Inconclusive — first result was unchanged from the default; not relied upon |
| `keyword` | — | `keyword=...` | **No** — silently ignored on `/jobs` (only `/jobs/<slug>` drives content) |

### Per-result fields (search)

Each result is an `<efc-job-card>` element. The parser (`parseJobCards` in
`cli/src/helpers.ts`) splits the HTML on that tag and parses each chunk independently.

| Field | Anchor |
|-------|--------|
| id | Digits after `.id` at the end of the job-title link's `href` (e.g. `...Some_Slug.id24528700` → `24528700`) |
| title | `title="..."` attribute on the `a.job-title` link (also duplicated in a nested `<h3>`) |
| company | `<div class="... company ...">TEXT</div>` |
| location | First `<span class="dot-divider">TEXT</span>` inside `<div class="... location ...">` — the **exact** class string `"dot-divider"` with no extra classes; a second span with class `"dot-divider ng-star-inserted"` in the same div carries the employment type (`Permanent`, etc.), not location |
| date | Relative-age text inside `<efc-job-meta>` (`"3 days ago"`, `"Today"`, `"1 month ago"`, ...) — converted to an approximate ISO timestamp by `relativeAgeToISO` |
| url | Same `href` as the title link, query string stripped |

No `postedDate`/exact-datetime is available on search cards — only the relative-age text.

## Detail

```
GET https://www.efinancialcareers.com/jobs-<anything>.id<jobId>
```

The slug segment before `.id<jobId>` is cosmetic — the server resolves purely on the
trailing `.id<digits>`, confirmed by fetching the same job under both its real slug and
a placeholder (`jobs-x-x.id24528700`) and getting byte-for-byte-equivalent content. This
skill's `DETAIL_BASE_URL` always uses the placeholder form, so `detail <id>` needs only
the numeric id.

Detail pages embed a clean **schema.org `JobPosting`** as JSON-LD:

```html
<script type="application/ld+json" id="jobPosting">{ ...JobPosting fields... }</script>
```

The CLI parses this JSON block directly (`parseJobDetail` in `cli/src/helpers.ts`)
instead of scraping the rendered DOM — far more robust than regex-parsing nested divs.
Fields used:

| LD field | Maps to |
|----------|---------|
| `title` | Has a `" | City, ST, Country"` SEO suffix baked in; the CLI prefers the page's `<h1 class="...font-heading-3...">` instead, which is the clean title, and only falls back to `title.split(" | ")[0]` if no `<h1>` is found |
| `hiringOrganization.name` | company |
| `jobLocation.address.{addressLocality,addressRegion,addressCountry}` | location (joined `", "`) |
| `datePosted` | date (already ISO) |
| `validThrough` | deadline |
| `employmentType` (array, e.g. `["FULL_TIME","PERMANENT"]`) | employmentType(s), title-cased |
| `baseSalary.{currency,value.{minValue,maxValue,unitText}}` | salary |
| `skills` | skills (comma-separated string, as returned) |
| `description` | description (HTML entities decoded, tags → newlines, `\r\n` normalized) |
| `url` | canonical job URL; also used as `applyUrl` |

No separate external "apply" URL is exposed — the site uses `"directApply": true`,
meaning applying happens on the job's own page (behind a login wall the CLI does not
cross). `applyUrl` is therefore set to the job's own `url`.

A `404` status, or a `200` response whose HTML has no `id="jobPosting"` script (e.g. an
expired/removed listing rendering a fallback page), both surface as `NOT_FOUND` — the
CLI does not distinguish them further.

## Notes

- No authentication required to view listings or job detail.
- Page size is fixed at 20 results per page for search.
- `crawl-delay: 10` in `robots.txt`; the CLI's own backoff (429/5xx, exponential,
  max ~6 retries) is separate from and does not substitute for pacing requests
  yourself — keep volume low regardless.
- Job ids are numeric (e.g. `24528700`) — pass them as-is to `detail`, or pass a full
  job URL / any string containing `.id<digits>`.
