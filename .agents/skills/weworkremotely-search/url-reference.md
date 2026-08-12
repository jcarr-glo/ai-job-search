# We Work Remotely URL Reference

Public, unauthenticated endpoints used by this skill. Global — We Work Remotely
(WWR) is a single remote-first job board with no per-market variants, so there is
no location parameter to plumb through (see Notes).

## Access check (recorded 2026-08-12)

- `robots.txt` (`https://weworkremotely.com/robots.txt`): `Allow: /` with
  `Disallow:` only on `/admin/`, `/account/`, `/job-seekers/account/`,
  `/job-seekers/profile/`, `/manage-company/`, and edit/cancel token URLs. The
  `/remote-jobs/` and `/categories/` paths this skill reads are **not** disallowed.
- No login is required to view search results or a full posting description —
  verified live by fetching several `/remote-jobs/<slug>` pages and reading the
  complete job body text without an account.
- `/terms-and-conditions` was checked for anti-scraping / automated-access
  language; none was found (only a broad content-license grant covering
  employer-submitted postings, unrelated to reading the public site).
- Net result: no personal-use warning banner is required in `SKILL.md` — this is
  a straightforward robots.txt-allowed, no-login-required portal. Kept volume low
  during investigation (a handful of requests) and the CLI backs off on 429/5xx.

## Search

```
GET https://weworkremotely.com/remote-jobs/search
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `term` | Free-text query (title, skill, role) | `engineering manager` |
| `sort` | Freshness bucket | `Past 24 Hours` \| `Past Week` \| `Past 2 Weeks` (omit for "Any Time") |

There is **no location/region query param** — the search form (`#wwr_search_form`
in the nav, `#advanced-search-form-header` on the results page) only has `term`
and the hidden `sort`/`job_filter` fields; a `job_filter` param (`hot`/`boosted`)
filters by promotion tier, not relevant here. Location must be folded into `term`.

The endpoint is **not paginated server-side** — a single request returns every
matching job in one HTML response (verified: a broad query like `engineer`
returned 144 results in one page, a narrower one 20, both with no `page=`/`next`
markers present). This CLI applies `--page`/`--limit` client-side over the full
parsed result set (20/page).

Returns an HTML page with a series of `<section class="jobs" id="category-N">`
blocks (one per job category the results span), each containing a flat `<ul>` of
`<li class=" new-listing-container ">` cards, plus occasional sponsored
`<li class="feature feature-listing-ad ...">` entries interleaved (a different
wrapper class, so splitting on the literal string `new-listing-container` skips
them automatically).

Per-card anchors (relative to the start of each split chunk):

| Field | Anchor |
|-------|--------|
| id / url | `<a class="listing-link--unlocked" href="/remote-jobs/<slug>">` — the slug **is** the id, there is no numeric job id |
| title | `<span class="new-listing__header__title__text">` |
| company | `<p class="new-listing__company-name">` |
| companyUrl | first `href="/company/<slug>"` in the chunk |
| location | `<p class="new-listing__company-headquarters">` — this is the **company's** headquarters/timezone-eligibility text (e.g. "San Francisco, California, USA", "Remote"), not a separate job-location field; WWR doesn't expose one |
| date | `<p class="new-listing__header__icons__date">` — relative text: `"8d"` (days ago) or a `<span class="new">New</span>` for same-day postings; converted to an ISO date client-side. No absolute-date attribute is present anywhere in the card markup |
| employmentType / region | two `<p class="new-listing__categories__category">` tags — usually `[Full-Time|Contract, <region tag e.g. "Anywhere in the World"/"US Only">]`; some cards inject an extra "Top 100" star-badge `<p>` ahead of these two, which the parser filters out by text match |

## Detail

```
GET https://weworkremotely.com/remote-jobs/<slug>
```

`<slug>` is the id from a `search` result (e.g. `lattice-engineering-manager-ai-1`).

**Quirk: unknown/expired slugs redirect to the homepage with HTTP 200**, not a
404 — status code alone cannot signal "not found". The detail page embeds a
schema.org `JobPosting` block (`<script type="application/ld+json">`) on every
real posting; its absence (`"@type" : "JobPosting"` not found in the response) is
what this CLI uses to detect a bad slug and report `NOT_FOUND`.

The JSON-LD block (present exactly once per detail page) carries the structured
fields this skill reads:

| JSON-LD path | Field |
|--------------|-------|
| `title` | title |
| `hiringOrganization.name` | company |
| `hiringOrganization.address` | location (a free-text string like `"Remote - Canada"` or `"San Francisco or Remote (U.S.)"`) |
| `employmentType` | employmentType |
| `datePosted` | date (truncated to `YYYY-MM-DD`) |
| `validThrough` | validThrough |
| `identifier.value` | the slug again (cross-check) |
| `description` | full posting HTML — **see Description decoding below** |

The `companyUrl` field is not in the JSON-LD block; it's taken from the first
`href="/company/<slug>"` anchor on the page (confirmed via byte offsets that the
listing's own company link always precedes any sponsor/ad company links further
down the page).

**Apply link**: the visible "Apply now" button is gated —
`<a class="apply-btn apply-btn--locked" href="/job-seekers/account/register?...">`
— it requires a free WWR account before revealing the real outbound apply URL.
This CLI cannot retrieve it from the public page, so `detail`'s `applyUrl` is
always `null`; the listing's own `url` is returned so the user can open it and
apply manually (or sign in to WWR).

### Description decoding

`description` in the JSON-LD block is a JSON string whose *content* is itself
HTML-entity-escaped HTML — e.g. the raw capture reads
`"&lt;p&gt;&lt;strong&gt;Location Requirement:&lt;/strong&gt;..."`. Because the
escaper runs over HTML that already contains real entities (e.g. `&amp;` in
"AD&D"), some entities come out **double-escaped** (`&amp;amp;`). The CLI:

1. Decodes entities once to reveal the real tags (`&lt;p&gt;` → `<p>`).
2. Converts `<br>` and block-closing tags (`</p>`, `</li>`, `</div>`, `</h*>`) to newlines, strips remaining tags.
3. Decodes entities a **second** time to resolve anything the first pass exposed (including the double-escaped ones, e.g. `&amp;amp;` → `&amp;` → `&`).

A single decode pass leaves visible `&amp;` artifacts in the output; verified by
diffing against the rendered page (`AD&D` in the benefits section rendered
correctly only after the second pass).

## Notes

- No authentication required for `search` or `detail` reads.
- Job ids are portal-native slugs (e.g. `lattice-engineering-manager-ai-1`), not numeric — pass them as-is to `detail`.
- `--jobage` maps to the `sort` param's three fixed buckets (see Search table above); there's no arbitrary day-count filter like LinkedIn's `f_TPR`.
- `search` has no location parameter; fold any region requirement into `--query` text (most WWR listings are remote-first already, so this matters less than on a local job board).
- The CLI retries 429/5xx with exponential backoff, matching `linkedin-search`.
