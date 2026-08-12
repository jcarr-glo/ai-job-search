// Data source: We Work Remotely's public site (weworkremotely.com). No authentication
// required to search or read a full posting. Search returns a server-rendered HTML page
// grouped into category sections, each holding a flat list of job cards; detail pages
// embed a schema.org JobPosting block (`<script type="application/ld+json">`) that we
// parse with regex rather than JSON.parse — the description field's raw text contains
// literal, un-escaped newlines, which is technically invalid JSON even though it is a
// perfectly parseable string with a regex capture.

export const SEARCH_URL = "https://weworkremotely.com/remote-jobs/search"
export const DETAIL_BASE_URL = "https://weworkremotely.com/remote-jobs"
export const SITE_ORIGIN = "https://weworkremotely.com"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; weworkremotely-search-cli/1.0)"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  companyUrl: string | null
  location: string | null
  date: string | null
  employmentType: string | null
  region: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  validThrough: string | null
  applyUrl: string | null
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points (e.g. emoji) decode
 * correctly, and drops out-of-range values instead of throwing.
 */
function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/**
 * Convert the description field embedded in WWR's JSON-LD block into readable text.
 *
 * The raw capture is a JSON string whose *content* is itself HTML-entity-escaped
 * HTML (e.g. `&lt;p&gt;...&lt;/p&gt;`), and because the escaper runs over HTML that
 * already contains real entities (e.g. `&amp;`), some entities come out
 * double-escaped (`&amp;amp;` -> should read as a literal `&`). One decode pass
 * reveals the real tags; stripping them and decoding a second time resolves any
 * entities exposed by the first pass (including the double-escaped ones).
 */
export function cleanLdDescription(raw: string | null | undefined): string | null {
  if (!raw) return null
  const revealed = decodeHtmlEntities(raw)
  const withBreaks = revealed
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const strippedOnce = withBreaks.replace(/<[^>]+>/g, " ")
  const text = decodeHtmlEntities(strippedOnce)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

function isoDateDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Convert a search card's relative date text ("8d", "New") into an ISO date. */
export function relativeDateToISO(raw: string | null): string | null {
  if (!raw) return null
  const text = raw.trim()
  if (!text) return null
  if (/^new$/i.test(text)) return isoDateDaysAgo(0)
  const m = text.match(/^(\d+)\s*d$/i)
  if (m) return isoDateDaysAgo(parseInt(m[1], 10))
  return null
}

/**
 * Parse the search-results page: a series of `<section class="jobs">` blocks (one
 * per category), each with a flat `<ul>` of `<li class="new-listing-container">`
 * cards. We split on that literal class string and parse each chunk independently
 * so one malformed card cannot break the rest. Sponsored `listing-ad` entries use a
 * different wrapper class and are naturally skipped by this split.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split("new-listing-container").slice(1)

  for (const chunk of chunks) {
    const idMatch = chunk.match(/listing-link--unlocked"\s+href="\/remote-jobs\/([^"?]+)"/)
    if (!idMatch) continue
    const id = idMatch[1]

    const titleMatch = chunk.match(/new-listing__header__title__text">([^<]*)</)
    if (!titleMatch) continue
    const title = clean(titleMatch[1])
    if (!title) continue

    const companyUrlMatch = chunk.match(/href="(\/company\/[^"]+)"/)
    const companyUrl = companyUrlMatch ? `${SITE_ORIGIN}${companyUrlMatch[1]}` : null

    const companyMatch = chunk.match(/new-listing__company-name">([^<]*)</)
    const company = companyMatch ? clean(companyMatch[1]) || null : null

    const locationMatch = chunk.match(/new-listing__company-headquarters">([^<]*)</)
    const location = locationMatch ? clean(locationMatch[1]) || null : null

    const dateBlockMatch = chunk.match(/new-listing__header__icons__date"[^>]*>([\s\S]*?)<\/p>/)
    const date = dateBlockMatch ? relativeDateToISO(clean(dateBlockMatch[1])) : null

    // Category tags: usually [employment type, region], but a "Top 100" star badge
    // is sometimes injected as an extra leading entry — drop it before indexing.
    const categoryTexts = [...chunk.matchAll(/new-listing__categories__category[^"]*">([\s\S]*?)<\/p>/g)]
      .map((m) => clean(m[1]) || null)
      .filter((t) => t && t !== "Top 100") as string[]
    const employmentType = categoryTexts[0] ?? null
    const region = categoryTexts[1] ?? null

    results.push({
      id,
      title,
      company,
      companyUrl,
      location,
      date,
      employmentType,
      region,
      url: `${DETAIL_BASE_URL}/${id}`,
    })
  }

  return results
}

const JOB_POSTING_MARKER = /"@type"\s*:\s*"JobPosting"/

/**
 * WWR answers an unknown/expired job slug with a 200 that redirects to the
 * homepage rather than a 404, so status code alone cannot detect "not found".
 * Presence of the schema.org JobPosting block is the reliable signal.
 */
export function looksLikeJobPostingPage(html: string): boolean {
  return JOB_POSTING_MARKER.test(html)
}

function extractLdJson(html: string): string | null {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)
  return m ? m[1] : null
}

/** Parse the single-job detail page via its embedded schema.org JobPosting block. */
export function parseJobDetail(html: string, id: string): JobDetail {
  const block = extractLdJson(html) ?? ""

  const titleRaw = block.match(/"title"\s*:\s*"([^"]*)"/)?.[1]
  const title = titleRaw ? decodeHtmlEntities(titleRaw) : "(untitled)"

  const companyRaw = block.match(/"hiringOrganization"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]*)"/)?.[1]
  const company = companyRaw ? decodeHtmlEntities(companyRaw) || null : null

  const locationRaw = block.match(/"hiringOrganization"\s*:\s*\{[\s\S]*?"address"\s*:\s*"([^"]*)"/)?.[1]
  const location = locationRaw ? decodeHtmlEntities(locationRaw) || null : null

  const employmentTypeRaw = block.match(/"employmentType"\s*:\s*"([^"]*)"/)?.[1]
  const employmentType = employmentTypeRaw ? decodeHtmlEntities(employmentTypeRaw) || null : null

  const datePostedRaw = block.match(/"datePosted"\s*:\s*"([^"]*)"/)?.[1]
  const date = datePostedRaw ? datePostedRaw.slice(0, 10) : null

  const validThroughRaw = block.match(/"validThrough"\s*:\s*"([^"]*)"/)?.[1]
  const validThrough = validThroughRaw ? validThroughRaw.slice(0, 10) : null

  const descriptionRaw = block.match(/"description"\s*:\s*"([^"]*)"/)?.[1]
  const description = cleanLdDescription(descriptionRaw)

  // The company-profile link is not in the JSON-LD block; the first `/company/`
  // href on the page is the listing's own company card, ahead of any sponsor links.
  const companyUrlMatch = html.match(/href="(\/company\/[^"]+)"/)
  const companyUrl = companyUrlMatch ? `${SITE_ORIGIN}${companyUrlMatch[1]}` : null

  return {
    id,
    title,
    company,
    companyUrl,
    location,
    date,
    employmentType,
    region: null,
    url: `${DETAIL_BASE_URL}/${id}`,
    description,
    validThrough,
    // WWR gates the real outbound apply link behind free-account sign-in (the
    // public "Apply now" button links to /job-seekers/account/register); it
    // cannot be retrieved from the public page, so this is always null.
    applyUrl: null,
  }
}

/**
 * Map a jobage (days) to WWR's `sort` query value. The portal only offers three
 * fixed freshness buckets (no arbitrary day count like LinkedIn's f_TPR), so this
 * rounds up to the smallest bucket that covers the request. Anything beyond 14
 * days (or unset) omits the filter — "Any Time".
 */
export function sortParamForJobage(days: number | undefined): string | null {
  if (!days || days <= 0 || days >= 9999) return null
  if (days <= 1) return "Past 24 Hours"
  if (days <= 7) return "Past Week"
  if (days <= 14) return "Past 2 Weeks"
  return null
}
