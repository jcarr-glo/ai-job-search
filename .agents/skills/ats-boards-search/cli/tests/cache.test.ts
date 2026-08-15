import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import type { JobCard } from "../src/helpers.js"

// The cache module reads its file path from ATS_BOARDS_CACHE_PATH once, at module
// load time, so it must be set before the module is first imported - hence the
// dynamic import below rather than a static one.
const tmpDir = mkdtempSync(join(tmpdir(), "ats-boards-cache-test-"))
process.env.ATS_BOARDS_CACHE_PATH = join(tmpDir, "board-cache.json")

const { hashJobList, getCachedLightweight, setCachedLightweight, getCachedFull, setCachedFull, __resetInMemoryCache } =
  await import("../src/cache.js")

function job(overrides: Partial<JobCard> = {}): JobCard {
  return {
    id: "1",
    title: "Head of Data",
    company: "Acme",
    location: "Remote",
    date: "2026-08-01",
    url: "https://example.com/jobs/1",
    ats: "greenhouse",
    sector: null,
    description: null,
    ...overrides,
  }
}

describe("hashJobList", () => {
  test("is stable regardless of input order", () => {
    const a = [job({ id: "1" }), job({ id: "2" })]
    const b = [job({ id: "2" }), job({ id: "1" })]
    expect(hashJobList(a)).toBe(hashJobList(b))
  })

  test("changes when a posting is added", () => {
    const before = [job({ id: "1" })]
    const after = [job({ id: "1" }), job({ id: "2" })]
    expect(hashJobList(before)).not.toBe(hashJobList(after))
  })

  test("changes when a posting's location or date moves", () => {
    const base = hashJobList([job({ location: "Remote" })])
    expect(hashJobList([job({ location: "New York" })])).not.toBe(base)
    expect(hashJobList([job({ date: "2026-08-02" })])).not.toBe(base)
  })

  test("ignores description text (not part of the change signal)", () => {
    const a = hashJobList([job({ description: "Version one of the copy" })])
    const b = hashJobList([job({ description: "Version two of the copy" })])
    expect(a).toBe(b)
  })
})

describe("lightweight cache", () => {
  test("miss when nothing has been cached for a slug", () => {
    expect(getCachedLightweight("nonexistent-slug")).toBeNull()
  })

  test("set then get round-trips the jobs and hash", () => {
    const jobs = [job({ id: "42" })]
    const hash = hashJobList(jobs)
    setCachedLightweight("acme", jobs, hash)
    const cached = getCachedLightweight("acme")
    expect(cached).not.toBeNull()
    expect(cached!.hash).toBe(hash)
    expect(cached!.jobs).toEqual(jobs)
  })

  test("survives an in-memory cache reset (reads back from disk)", () => {
    const jobs = [job({ id: "99" })]
    const hash = hashJobList(jobs)
    setCachedLightweight("persisted-co", jobs, hash)
    __resetInMemoryCache()
    const cached = getCachedLightweight("persisted-co")
    expect(cached?.jobs).toEqual(jobs)
  })
})

describe("full-content cache", () => {
  test("miss when nothing has been cached", () => {
    expect(getCachedFull("no-full-yet", "some-hash")).toBeNull()
  })

  test("hit only when the supplied hash matches the hash it was stored under", () => {
    const jobs = [job({ id: "7", description: "Full text here" })]
    setCachedFull("widgetco", jobs, "hash-a")
    expect(getCachedFull("widgetco", "hash-a")).toEqual(jobs)
    expect(getCachedFull("widgetco", "hash-b")).toBeNull()
  })

  test("a roster change (new hash) invalidates the cached full fetch", () => {
    const before = [job({ id: "1", description: "old" })]
    setCachedFull("rotate-co", before, hashJobList(before))

    const after = [job({ id: "1", description: "old" }), job({ id: "2", description: "new" })]
    const afterHash = hashJobList(after)
    expect(getCachedFull("rotate-co", afterHash)).toBeNull()
  })
})
