// Data source: the public, unauthenticated JSON job-board APIs behind three ATS
// platforms that most funded startups and mid-size scale-ups use for their careers
// page — Greenhouse, Lever, and Ashby. Each returns a full JSON list of that one
// company's open jobs in a single call (no server-side keyword search or pagination),
// so this CLI fetches per-company and filters/sorts/paginates client-side across a
// curated company registry (../../companies.json).

import { readFileSync } from "fs"
import { join } from "path"
import { hashJobList, getCachedLightweight, setCachedLightweight, getCachedFull, setCachedFull } from "./cache.js"

const UA = "Mozilla/5.0 (compatible; ats-boards-search-cli/1.0)"
const COMPANIES_PATH = join(import.meta.dir, "../../companies.json")

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export type Ats = "greenhouse" | "lever" | "ashby"

export interface Company {
  name: string
  sector?: string
  ats: Ats
  slug: string
  careers_url?: string
  notes?: string
}

export interface JobCard {
  id: string
  title: string
  company: string
  location: string | null
  date: string | null
  url: string
  ats: Ats
  sector: string | null
  description: string | null
}

/** Load the curated company registry from companies.json. */
export function loadCompanies(): Company[] {
  const raw = JSON.parse(readFileSync(COMPANIES_PATH, "utf-8"))
  if (!raw || !Array.isArray(raw.companies)) return []
  return raw.companies as Company[]
}

export function findCompany(companies: Company[], slug: string): Company | null {
  const needle = slug.toLowerCase()
  return companies.find((c) => c.slug.toLowerCase() === needle) ?? null
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function cleanText(text: string | null | undefined): string | null {
  if (!text) return null
  const cleaned = stripTags(decodeHtmlEntities(text)).trim()
  return cleaned || null
}

/**
 * Greenhouse's `content` field is HTML with its own tags encoded as entities
 * (e.g. "&lt;div&gt;"), so it needs one entity-decode pass before tag-stripping.
 */
function decodeGreenhouseContent(content: string): string | null {
  const html = decodeHtmlEntities(content)
  return cleanText(html)
}

interface JsonFetchResult {
  status: number
  json: unknown | null
}

/** Fetch JSON with exponential backoff on 429/5xx. A non-JSON body (e.g. Ashby's
 * plain-text 404) is returned as `json: null`, never thrown. */
async function jsonFetch(url: string): Promise<JsonFetchResult> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
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
    const text = await response.text()
    let json: unknown | null = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { status: response.status, json }
  }
  throw new Error("Request failed after max retries")
}

async function fetchGreenhouse(company: Company, withContent: boolean): Promise<JobCard[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.slug)}/jobs${withContent ? "?content=true" : ""}`
  const { status, json } = await jsonFetch(url)
  if (status === 404 || status >= 400 || !json || typeof json !== "object") return []
  const jobs = (json as Record<string, unknown>).jobs
  if (!Array.isArray(jobs)) return []
  return jobs.map((j: any): JobCard => ({
    id: String(j.id),
    title: cleanText(j.title) ?? "(untitled)",
    company: company.name,
    location: j.location?.name ?? null,
    date: j.first_published ?? j.updated_at ?? null,
    url: j.absolute_url ?? company.careers_url ?? "",
    ats: "greenhouse",
    sector: company.sector ?? null,
    description: withContent && j.content ? decodeGreenhouseContent(j.content) : null,
  }))
}

async function fetchLever(company: Company): Promise<JobCard[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company.slug)}?mode=json`
  const { status, json } = await jsonFetch(url)
  if (status === 404 || status >= 400 || !Array.isArray(json)) return []
  return (json as any[]).map((p): JobCard => ({
    id: String(p.id),
    title: cleanText(p.text) ?? "(untitled)",
    company: company.name,
    location: p.categories?.location ?? null,
    date: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : null,
    url: p.hostedUrl ?? company.careers_url ?? "",
    ats: "lever",
    sector: company.sector ?? null,
    description: p.descriptionPlain ?? null,
  }))
}

async function fetchAshby(company: Company): Promise<JobCard[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.slug)}`
  const { status, json } = await jsonFetch(url)
  if (status === 404 || status >= 400 || !json || typeof json !== "object") return []
  const jobs = (json as Record<string, unknown>).jobs
  if (!Array.isArray(jobs)) return []
  return jobs.map((j: any): JobCard => ({
    id: String(j.id),
    title: cleanText(j.title) ?? "(untitled)",
    company: company.name,
    location: j.location ?? null,
    date: j.publishedAt ? String(j.publishedAt).slice(0, 10) : null,
    url: j.jobUrl ?? company.careers_url ?? "",
    ats: "ashby",
    sector: company.sector ?? null,
    description: j.descriptionPlain ?? null,
  }))
}

/** Fetch one company's job list, normalized to JobCard[]. `content` requests full
 * descriptions where the ATS needs an explicit flag (Greenhouse only — Lever and
 * Ashby always include the description in their list response).
 *
 * Change-detection cache: a company's lightweight roster (id/title/location/date)
 * is cached for an hour so the several title queries one /scrape run typically
 * fires don't each re-fetch the same board. For Greenhouse, the separately-cached
 * full-description fetch is skipped entirely whenever the lightweight roster's
 * hash hasn't moved since the last time it was paid for — a board with zero
 * postings added/removed/moved never re-downloads descriptions it already has. */
export async function fetchCompanyJobs(company: Company, opts: { content?: boolean } = {}): Promise<JobCard[]> {
  if (company.ats !== "greenhouse") {
    // Lever/Ashby have no separate lightweight mode - the list response already
    // carries full descriptions, so one cached fetch satisfies both call shapes.
    const cached = getCachedLightweight(company.slug)
    if (cached) return cached.jobs
    const jobs = company.ats === "lever" ? await fetchLever(company) : company.ats === "ashby" ? await fetchAshby(company) : []
    setCachedLightweight(company.slug, jobs, hashJobList(jobs))
    return jobs
  }

  let light = getCachedLightweight(company.slug)
  if (!light) {
    const jobs = await fetchGreenhouse(company, false)
    const hash = hashJobList(jobs)
    setCachedLightweight(company.slug, jobs, hash)
    light = { hash, jobs }
  }
  if (!opts.content) return light.jobs

  const cachedFull = getCachedFull(company.slug, light.hash)
  if (cachedFull) return cachedFull

  const fullJobs = await fetchGreenhouse(company, true)
  setCachedFull(company.slug, fullJobs, light.hash)
  return fullJobs
}

/** Run async work over a list with bounded concurrency, so a broad search across
 * the whole registry doesn't fire 50+ simultaneous requests at once. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** Identify the ATS, company slug, and job id from a posting URL, for `detail`. */
export function parseDetailUrl(url: string): { ats: Ats; slug: string; id: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const parts = u.pathname.split("/").filter(Boolean)

    if (host.endsWith("greenhouse.io")) {
      // boards.greenhouse.io/<slug>/jobs/<id> or job-boards.greenhouse.io/<slug>/jobs/<id>
      const jobsIdx = parts.indexOf("jobs")
      if (jobsIdx > 0 && parts[jobsIdx + 1]) {
        return { ats: "greenhouse", slug: parts[jobsIdx - 1], id: parts[jobsIdx + 1] }
      }
      return null
    }
    if (host === "jobs.lever.co" && parts.length >= 2) {
      return { ats: "lever", slug: parts[0], id: parts[1] }
    }
    if (host === "jobs.ashbyhq.com" && parts.length >= 2) {
      return { ats: "ashby", slug: parts[0], id: parts[1] }
    }
    return null
  } catch {
    return null
  }
}
