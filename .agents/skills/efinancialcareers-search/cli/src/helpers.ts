// Data source: eFinancialCareers' public, server-side-rendered job pages (an Angular
// Universal app — the initial HTML response already contains the job cards / job
// detail, no headless browser needed). Search results are HTML job cards; job detail
// pages embed a clean schema.org JobPosting as JSON-LD, which we parse directly instead
// of scraping the rendered DOM (see parseJobDetail below).
//
// PERSONAL USE ONLY — see SKILL.md. eFinancialCareers' Terms & Conditions prohibit bots
// and automated data mining; robots.txt does not disallow the /jobs paths this CLI uses
// and no login is required to view listings, but the ToS restriction applies regardless.
// Keep volume low.

export const SEARCH_BASE_URL = "https://www.efinancialcareers.com/jobs"
// The detail URL's slug segment is cosmetic — only the trailing ".id<number>" is
// resolved server-side, so any placeholder slug works.
export const DETAIL_BASE_URL = "https://www.efinancialcareers.com/jobs-x-x.id"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; efinancialcareers-search-cli/1.0)"

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
  location: string | null
  date: string | null
  url: string
  employmentType: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentTypes: string[] | null
  salary: string | null
  deadline: string | null
  skills: string | null
  applyUrl: string | null
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` (not
 * `fromCharCode`) so supplementary-plane code points (e.g. emoji, U+1F600)
 * decode correctly, and drops out-of-range values instead of throwing.
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
    // Numeric character references: decimal (&#233;) and hexadecimal (&#xE9;).
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
 * Build the /jobs/<slug> search path segment from a free-text query. The portal
 * resolves this server-side (SSR) by slug, not by a `?keyword=` query param, and
 * accepts hyphen-joined, percent-encoded tokens (confirmed live: encoded "+" in
 * "C%2B%2B-Developer" works; a literal encoded space "%20" does not — words must
 * be hyphen-joined instead).
 */
export function querySlug(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("-")
}

/** Marker text the SSR page renders when a search slug has zero matches. */
const NO_RESULTS_MARKER = "No jobs found matching your search criteria"

/**
 * Convert eFinancialCareers' relative posting-age text ("3 days ago", "Today",
 * "1 month ago", ...) into an approximate ISO-8601 timestamp. The portal does not
 * expose the exact `datePosted` on search cards (only on the detail page's
 * JSON-LD), so this is necessarily approximate — good enough for `--jobage`
 * filtering and display.
 */
export function relativeAgeToISO(text: string, now: Date = new Date()): string | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  if (t === "today" || t === "just now") return now.toISOString()
  if (t === "yesterday") return new Date(now.getTime() - 86400000).toISOString()

  const m = t.match(/^(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago$/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  const unit = m[2]
  const msPerUnit: Record<string, number> = {
    minute: 60000,
    hour: 3600000,
    day: 86400000,
    week: 7 * 86400000,
    month: 30 * 86400000,
    year: 365 * 86400000,
  }
  return new Date(now.getTime() - n * msPerUnit[unit]).toISOString()
}

/** Extract the numeric job id from a job URL's trailing ".id<digits>". */
function idFromUrl(url: string): string | null {
  const m = url.match(/\.id(\d+)(?:$|[?#])/)
  return m ? m[1] : null
}

/**
 * Parse the search-results page: a flat sequence of <efc-job-card> elements.
 * We split on the tag and parse each chunk independently so one malformed card
 * cannot break the rest. Returns [] when the page shows the "no jobs found"
 * marker, even if it also renders unrelated "recommended jobs" cards below it.
 */
export function parseJobCards(html: string): JobCard[] {
  if (html.includes(NO_RESULTS_MARKER)) return []

  const results: JobCard[] = []
  const chunks = html.split(/<efc-job-card[\s>]/).slice(1)

  for (const chunk of chunks) {
    const linkMatch = chunk.match(
      /class="[^"]*\bjob-title\b[^"]*"[^>]*href="([^"]+)"[^>]*title="([^"]+)"/i,
    )
    if (!linkMatch) continue
    const url = decodeHtmlEntities(linkMatch[1]).split("?")[0]
    const title = decodeHtmlEntities(linkMatch[2])
    const id = idFromUrl(url)
    if (!id || !title) continue

    const companyMatch = chunk.match(/class="[^"]*\bcompany\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const company = companyMatch ? clean(companyMatch[1]) || null : null

    let location: string | null = null
    let employmentType: string | null = null
    const locBlock = chunk.match(/class="[^"]*\blocation\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    if (locBlock) {
      const spans = [...locBlock[1].matchAll(/<span[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/span>/gi)]
      if (spans[0]) location = clean(spans[0][2]) || null
      if (spans[1]) employmentType = clean(spans[1][2]) || null
    }

    let date: string | null = null
    const metaMatch = chunk.match(
      /<efc-job-meta[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
    )
    if (metaMatch) date = relativeAgeToISO(clean(metaMatch[1]))

    results.push({ id, title, company, location, date, url, employmentType })
  }

  return results
}

interface JobPostingLD {
  title?: string
  description?: string
  datePosted?: string
  validThrough?: string
  employmentType?: string[] | string
  skills?: string
  url?: string
  hiringOrganization?: { name?: string }
  jobLocation?: {
    address?: {
      addressLocality?: string
      addressRegion?: string
      addressCountry?: string
    }
  }
  baseSalary?: {
    currency?: string
    value?: { minValue?: number; maxValue?: number; unitText?: string }
  }
}

function extractJobPostingLD(html: string): JobPostingLD | null {
  const m = html.match(
    /<script type="application\/ld\+json" id="jobPosting"[^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!m) return null
  try {
    return JSON.parse(m[1]) as JobPostingLD
  } catch {
    return null
  }
}

function formatDescription(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, "\n"))
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function formatEmploymentTypes(types: string[] | string | undefined): string[] | null {
  if (!types) return null
  const arr = Array.isArray(types) ? types : [types]
  if (arr.length === 0) return null
  return arr.map((t) =>
    t
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  )
}

function formatSalary(baseSalary: JobPostingLD["baseSalary"]): string | null {
  if (!baseSalary?.value) return null
  const { minValue, maxValue, unitText } = baseSalary.value
  const currency = baseSalary.currency || ""
  if (minValue === undefined && maxValue === undefined) return null
  const range =
    minValue !== undefined && maxValue !== undefined && minValue !== maxValue
      ? `${minValue.toLocaleString()}–${maxValue.toLocaleString()}`
      : `${(minValue ?? maxValue)!.toLocaleString()}`
  const unit = unitText ? `/${unitText.toLowerCase()}` : ""
  return `${currency} ${range}${unit}`.trim()
}

function formatLocation(loc: JobPostingLD["jobLocation"]): string | null {
  const addr = loc?.address
  if (!addr) return null
  const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean)
  return parts.length ? parts.join(", ") : null
}

/** Pull the human-facing <h1> title if present — cleaner than the LD title
 * (which has a " | City, ST, Country" suffix baked in for SEO). */
function pageTitle(html: string): string | null {
  const m = html.match(/<h1[^>]*class="[^"]*font-heading-3[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
  return m ? clean(m[1]) || null : null
}

/** Parse the single-job detail page via its embedded schema.org JobPosting JSON-LD. */
export function parseJobDetail(html: string, id: string): JobDetail | null {
  const ld = extractJobPostingLD(html)
  if (!ld) return null

  const title = pageTitle(html) || (ld.title ? ld.title.split(" | ")[0] : null) || "(untitled)"
  const url = ld.url || `${DETAIL_BASE_URL}${id}`
  const employmentTypes = formatEmploymentTypes(ld.employmentType)

  return {
    id,
    title,
    company: ld.hiringOrganization?.name || null,
    location: formatLocation(ld.jobLocation),
    date: ld.datePosted || null,
    url,
    employmentType: employmentTypes ? employmentTypes.join(", ") : null,
    description: ld.description ? formatDescription(ld.description) : null,
    employmentTypes,
    salary: formatSalary(ld.baseSalary),
    deadline: ld.validThrough || null,
    skills: ld.skills || null,
    // eFinancialCareers uses "directApply" (apply on-site, behind login) rather
    // than an external apply URL — the job's own page is the apply entry point.
    applyUrl: url,
  }
}
