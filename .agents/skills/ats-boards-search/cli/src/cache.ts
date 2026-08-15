// Local, on-disk change-detection cache so repeated /scrape runs (or repeated
// queries within one run - a broad sweep typically fires several title queries
// back to back) don't re-pay for the same company board fetch when nothing has
// changed. Not committed to git - see .gitignore. A missing or corrupt cache
// file is treated as empty; a caching bug should degrade to "fetch everything",
// never to a crash.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { createHash } from "crypto"
import type { JobCard } from "./helpers.js"

const CACHE_PATH = process.env.ATS_BOARDS_CACHE_PATH ?? join(import.meta.dir, "../.cache/board-cache.json")

// Long enough to dedupe the several title queries a single /scrape run typically
// fires against the same registry sweep; short enough that the next day's run
// still sees same-day postings rather than trusting a stale snapshot.
const LIGHTWEIGHT_TTL_MS = 60 * 60 * 1000

interface LightweightEntry {
  fetchedAt: string
  hash: string
  jobs: JobCard[]
}

interface FullEntry {
  hash: string // the lightweight hash in effect when this full-content fetch ran
  jobs: JobCard[]
}

interface CacheEntry {
  lightweight?: LightweightEntry
  full?: FullEntry
}

interface CacheFile {
  companies: Record<string, CacheEntry>
}

let cache: CacheFile | null = null

function load(): CacheFile {
  if (cache) return cache
  try {
    cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : { companies: {} }
  } catch {
    cache = { companies: {} }
  }
  if (!cache!.companies) cache!.companies = {}
  return cache!
}

function persist(): void {
  if (!cache) return
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
  } catch {
    // Cache is a pure optimization - a write failure (read-only fs, disk full)
    // degrades to "always fetch", never breaks the command.
  }
}

/** Fingerprint a job list as a proxy for "has this company's board changed" -
 * catches postings added, removed, moved, or re-dated. It does NOT catch an
 * in-place text edit to an otherwise-unchanged posting (e.g. a salary tweak),
 * since id/title/location/date are what's cheap to get without the full fetch
 * this cache exists to avoid. */
export function hashJobList(jobs: JobCard[]): string {
  const signature = jobs
    .map((j) => `${j.id}|${j.title}|${j.location ?? ""}|${j.date ?? ""}`)
    .sort()
    .join("\n")
  return createHash("sha1").update(signature).digest("hex")
}

export function getCachedLightweight(slug: string): { hash: string; jobs: JobCard[] } | null {
  const entry = load().companies[slug]?.lightweight
  if (!entry) return null
  if (Date.now() - Date.parse(entry.fetchedAt) > LIGHTWEIGHT_TTL_MS) return null
  return { hash: entry.hash, jobs: entry.jobs }
}

export function setCachedLightweight(slug: string, jobs: JobCard[], hash: string): void {
  const c = load()
  c.companies[slug] = { ...c.companies[slug], lightweight: { fetchedAt: new Date().toISOString(), hash, jobs } }
  persist()
}

/** Returns the cached full-description job list only if the board hasn't moved
 * since that fetch (the lightweight hash from back then still matches now). */
export function getCachedFull(slug: string, currentHash: string): JobCard[] | null {
  const entry = load().companies[slug]?.full
  if (!entry || entry.hash !== currentHash) return null
  return entry.jobs
}

export function setCachedFull(slug: string, jobs: JobCard[], hash: string): void {
  const c = load()
  c.companies[slug] = { ...c.companies[slug], full: { hash, jobs } }
  persist()
}

/** Test-only: drop the in-memory cache so the next load() re-reads CACHE_PATH. */
export function __resetInMemoryCache(): void {
  cache = null
}
