import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

// Live smoke test against the real weworkremotely.com site (per add-portal.md
// Step 3/4 — a portal skill must be verified against live data, not just mocks).
// Keep volume low: this is the only network-touching test file.

interface SearchResult {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  date: string | null;
  url: string;
}
interface SearchResponse {
  meta: { count: number; page: number; total: number };
  results: SearchResult[];
}

describe("weworkremotely CLI live smoke test", () => {
  test("search 'engineering manager' returns real, non-null results", async () => {
    const result = await runCLI(["search", "-q", "engineering manager", "--limit", "5", "--format", "json"]);
    expect(result.exitCode).toBe(0);
    const parsed = parseJSON<SearchResponse>(result);
    expect(parsed.results.length).toBeGreaterThan(0);
    const first = parsed.results[0];
    expect(first.id).toBeTruthy();
    expect(first.title).toBeTruthy();
    expect(first.url).toMatch(/^https:\/\/weworkremotely\.com\/remote-jobs\//);
  }, 30000);

  test("a bogus flag exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--jobage", "not-a-number"]);
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("BAD_ARG");
  });

  test("missing required detail id exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["detail"]);
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("NO_ID");
  });

  test("detail on a bogus slug exits 1 with NOT_FOUND (redirect-to-homepage case)", async () => {
    const result = await runCLI(["detail", "this-slug-should-not-exist-xyz-123456"]);
    expect(result.exitCode).not.toBe(0);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("NOT_FOUND");
  }, 30000);
});
