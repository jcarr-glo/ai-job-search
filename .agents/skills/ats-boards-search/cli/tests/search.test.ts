import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResult {
  meta: { count: number; page: number; totalMatched: number }
  results: Array<{ id: string; title: string; company: string; url: string; ats: string }>
}

// Live smoke test against the real Greenhouse API - AlphaSense reliably carries a
// large, active board so this should never legitimately return zero results.
describe("live: search --company alphasense", () => {
  test("returns real results with non-null id/title/url", async () => {
    const result = await runCLI(["search", "--company", "alphasense", "--format", "json"])
    const body = parseJSON<SearchResult>(result)
    expect(body.results.length).toBeGreaterThan(0)
    for (const job of body.results) {
      expect(job.id).toBeTruthy()
      expect(job.title).toBeTruthy()
      expect(job.url).toContain("greenhouse.io")
    }
  }, 20000)

  test("detail on the first result returns a readable description", async () => {
    const search = parseJSON<SearchResult>(await runCLI(["search", "--company", "alphasense", "--format", "json"]))
    const first = search.results[0]
    const detail = await runCLI(["detail", first.url, "--format", "plain"])
    expect(detail.exitCode).toBe(0)
    expect(detail.stdout).toContain(first.title)
    expect(detail.stdout.length).toBeGreaterThan(50)
  }, 20000)
})

// Live smoke test across the whole registry, scoped to one ATS to keep it fast.
describe("live: search --ats ashby -q engineer", () => {
  test("returns results tagged with the ashby ats", async () => {
    const result = await runCLI(["search", "--ats", "ashby", "-q", "engineer", "--format", "json"])
    const body = parseJSON<SearchResult>(result)
    for (const job of body.results) {
      expect(job.ats).toBe("ashby")
    }
  }, 30000)
})
