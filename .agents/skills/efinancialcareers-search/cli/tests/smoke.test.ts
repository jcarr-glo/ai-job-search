import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

// Live smoke test against the real eFinancialCareers site, per the portal-skill
// contract (see /add-portal Step 4). Keep this file's request volume to a single
// call. If eFinancialCareers changes its markup, this is the test that will catch it.

interface SearchResult {
  meta: { count: number; page: number };
  results: Array<{ id: string; title: string; url: string }>;
}

describe("live smoke test", () => {
  test("search 'Head of Technology' returns real, non-empty results", async () => {
    const result = await runCLI(["search", "-q", "Head of Technology", "--limit", "5", "--format", "json"]);
    expect(result.exitCode).toBe(0);
    const parsed = parseJSON<SearchResult>(result);
    expect(parsed.results.length).toBeGreaterThan(0);
    for (const r of parsed.results) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.url).toMatch(/^https:\/\/www\.efinancialcareers\.com\//);
    }
  }, 30000);
});
