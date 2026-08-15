import { describe, expect, test } from "bun:test"
import { cleanText, findCompany, loadCompanies, parseDetailUrl, type Company } from "../src/helpers.js"

describe("cleanText", () => {
  test("strips tags and decodes entities", () => {
    expect(cleanText("<div>Join us &amp; grow</div>")).toBe("Join us & grow")
  })
  test("returns null for empty/whitespace input", () => {
    expect(cleanText("")).toBeNull()
    expect(cleanText("   ")).toBeNull()
    expect(cleanText(null)).toBeNull()
    expect(cleanText(undefined)).toBeNull()
  })
  test("decodes numeric entities including out-of-BMP code points", () => {
    expect(cleanText("&#233;clair")).toBe("éclair")
  })
})

describe("parseDetailUrl", () => {
  test("parses a Greenhouse job-boards URL", () => {
    expect(parseDetailUrl("https://job-boards.greenhouse.io/kalshi/jobs/1234567")).toEqual({
      ats: "greenhouse",
      slug: "kalshi",
      id: "1234567",
    })
  })
  test("parses a Greenhouse boards.greenhouse.io URL", () => {
    expect(parseDetailUrl("https://boards.greenhouse.io/robinhood/jobs/8114351?t=x")).toEqual({
      ats: "greenhouse",
      slug: "robinhood",
      id: "8114351",
    })
  })
  test("parses a Lever URL", () => {
    expect(parseDetailUrl("https://jobs.lever.co/anchorage/abc-123-def")).toEqual({
      ats: "lever",
      slug: "anchorage",
      id: "abc-123-def",
    })
  })
  test("parses an Ashby URL", () => {
    expect(parseDetailUrl("https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245")).toEqual({
      ats: "ashby",
      slug: "ramp",
      id: "34413f8d-26bf-4bbc-8ade-eb309a0e2245",
    })
  })
  test("returns null for an unrecognized host", () => {
    expect(parseDetailUrl("https://example.com/jobs/123")).toBeNull()
  })
  test("returns null for malformed input", () => {
    expect(parseDetailUrl("not a url")).toBeNull()
  })
})

describe("findCompany", () => {
  const companies: Company[] = [
    { name: "Ramp", ats: "ashby", slug: "ramp" },
    { name: "Kalshi", ats: "greenhouse", slug: "kalshi" },
  ]
  test("finds by exact slug", () => {
    expect(findCompany(companies, "kalshi")?.name).toBe("Kalshi")
  })
  test("matches case-insensitively", () => {
    expect(findCompany(companies, "RAMP")?.name).toBe("Ramp")
  })
  test("returns null when not found", () => {
    expect(findCompany(companies, "nonexistent")).toBeNull()
  })
})

describe("loadCompanies", () => {
  test("loads the real registry with valid entries", () => {
    const companies = loadCompanies()
    expect(companies.length).toBeGreaterThan(20)
    for (const c of companies) {
      expect(typeof c.name).toBe("string")
      expect(["greenhouse", "lever", "ashby"]).toContain(c.ats)
      expect(typeof c.slug).toBe("string")
      expect(c.slug.length).toBeGreaterThan(0)
    }
  })
})
