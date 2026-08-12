import { describe, test, expect } from "bun:test";
import { parseJobCards, parseJobDetail, querySlug, relativeAgeToISO } from "../src/helpers";

// Minimal search-card markup mirroring eFinancialCareers' real <efc-job-card>
// structure (captured live on 2026-08-12): a job-title link with href+title,
// a company div, a location div with two "dot-divider" spans (location, then
// employment type), and an efc-job-meta relative-age span.
function searchCard(
  id: string,
  title: string,
  opts: { company?: string; location?: string; employmentType?: string; age?: string } = {},
): string {
  const { company = "Acme Bank", location = "New York, United States", employmentType = "Permanent", age = "3 days ago" } = opts;
  return `<efc-job-card class="job-card"><div class="component-card"><div class="card-info"><efc-card-details><div class="title"><a class="job-title job-title-spacing" id="x" href="https://www.efinancialcareers.com/jobs-United_States-New_York-Some_Slug.id${id}" target="_self" title="${title}">  <h3>${title}</h3></a></div><div class="font-body-3 company col ng-star-inserted"> ${company} </div><div class="font-helper-text location col ng-star-inserted"><span class="dot-divider">${location}</span><span class="dot-divider ng-star-inserted">${employmentType}</span></div></efc-card-details><efc-card-footer><efc-job-meta id="metaInfo"><span class="font-helper-text dot-divider color-font-secondary ng-star-inserted"> ${age} </span></efc-job-meta></efc-card-footer></div></div></efc-job-card>`;
}

describe("querySlug", () => {
  test("joins words with hyphens", () => {
    expect(querySlug("Head of Technology")).toBe("Head-of-Technology");
  });

  test("percent-encodes special characters per-token (matches live-verified C%2B%2B-Developer)", () => {
    expect(querySlug("C++ Developer")).toBe("C%2B%2B-Developer");
  });

  test("trims and collapses internal whitespace runs", () => {
    expect(querySlug("  risk   manager  ")).toBe("risk-manager");
  });
});

describe("relativeAgeToISO", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  test("parses 'N days ago'", () => {
    const iso = relativeAgeToISO("3 days ago", now);
    expect(iso).toBe(new Date(now.getTime() - 3 * 86400000).toISOString());
  });

  test("parses 'Today'", () => {
    expect(relativeAgeToISO("Today", now)).toBe(now.toISOString());
  });

  test("parses 'N month(s) ago'", () => {
    const iso = relativeAgeToISO("1 month ago", now);
    expect(iso).toBe(new Date(now.getTime() - 30 * 86400000).toISOString());
  });

  test("returns null for unrecognized text", () => {
    expect(relativeAgeToISO("sometime")).toBeNull();
  });
});

describe("parseJobCards", () => {
  test("parses id, title, company, location, employmentType, date, url from a card", () => {
    const html = searchCard("24528700", "Head of Technology");
    const [card] = parseJobCards(html);
    expect(card.id).toBe("24528700");
    expect(card.title).toBe("Head of Technology");
    expect(card.company).toBe("Acme Bank");
    expect(card.location).toBe("New York, United States");
    expect(card.employmentType).toBe("Permanent");
    expect(card.date).not.toBeNull();
    expect(card.url).toBe("https://www.efinancialcareers.com/jobs-United_States-New_York-Some_Slug.id24528700");
  });

  test("decodes HTML entities in title and company", () => {
    const html = searchCard("1", "Head of Technology &amp; Data", { company: "Smith &amp; Co" });
    const [card] = parseJobCards(html);
    expect(card.title).toBe("Head of Technology & Data");
    expect(card.company).toBe("Smith & Co");
  });

  test("parses multiple cards independently — one malformed card doesn't break the rest", () => {
    const good1 = searchCard("1", "Engineer");
    const malformed = "<efc-job-card>garbage, no job-title link here</efc-job-card>";
    const good2 = searchCard("2", "Analyst");
    const cards = parseJobCards(good1 + malformed + good2);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.id)).toEqual(["1", "2"]);
  });

  test("returns [] when the page shows the no-results marker, even with recommended cards present", () => {
    const html =
      "<h2>No jobs found matching your search criteria.</h2>" + searchCard("999", "Unrelated Suggestion");
    expect(parseJobCards(html)).toEqual([]);
  });

  test("returns [] for empty input", () => {
    expect(parseJobCards("")).toEqual([]);
  });
});

// Minimal detail-page fixture: the schema.org JobPosting JSON-LD block this CLI
// actually parses (real shape captured live from a job detail page), plus the h1
// title the CLI prefers over the LD title's " | City, ST, Country" SEO suffix.
function detailHtml(overrides: Record<string, unknown> = {}): string {
  const ld = {
    title: "AVP, Global Head of Technology Sourcing | New York, NY, USA",
    description: "Line one.\r\n\r\nLine two &amp; more.",
    datePosted: "2026-07-16T08:06:44+0000",
    validThrough: "2050-01-01T23:45:00+0000",
    employmentType: ["FULL_TIME", "PERMANENT"],
    skills: "Technology,Leadership",
    url: "https://www.efinancialcareers.com/jobs-USA-NY-New_York-AVP.id24528700",
    hiringOrganization: { name: "Nasdaq" },
    jobLocation: { address: { addressLocality: "New York", addressRegion: "NY", addressCountry: "US" } },
    baseSalary: { currency: "USD", value: { minValue: 148000, maxValue: 274000, unitText: "YEAR" } },
    ...overrides,
  };
  return `<html><body><h1 class="font-heading-3 mb-0 w-100 ellipsis-2-row">AVP, Global Head of Technology Sourcing</h1><script type="application/ld+json" id="jobPosting">${JSON.stringify(ld)}</script></body></html>`;
}

describe("parseJobDetail", () => {
  test("prefers the clean h1 title over the LD title's SEO suffix", () => {
    const job = parseJobDetail(detailHtml(), "24528700");
    expect(job?.title).toBe("AVP, Global Head of Technology Sourcing");
  });

  test("extracts company, location, date, employmentType, salary, deadline, skills, url", () => {
    const job = parseJobDetail(detailHtml(), "24528700");
    expect(job?.company).toBe("Nasdaq");
    expect(job?.location).toBe("New York, NY, US");
    expect(job?.date).toBe("2026-07-16T08:06:44+0000");
    expect(job?.employmentType).toBe("Full Time, Permanent");
    expect(job?.salary).toBe("USD 148,000–274,000/year");
    expect(job?.deadline).toBe("2050-01-01T23:45:00+0000");
    expect(job?.skills).toBe("Technology,Leadership");
    expect(job?.url).toBe("https://www.efinancialcareers.com/jobs-USA-NY-New_York-AVP.id24528700");
    expect(job?.applyUrl).toBe(job?.url);
  });

  test("decodes entities and normalizes line breaks in the description", () => {
    const job = parseJobDetail(detailHtml(), "24528700");
    expect(job?.description).toBe("Line one.\n\nLine two & more.");
  });

  test("falls back to LD title (minus SEO suffix) when no h1 is present", () => {
    const ld = {
      title: "Risk Manager | London, UK",
      description: "desc",
      hiringOrganization: { name: "Barclays" },
    };
    const html = `<html><body><script type="application/ld+json" id="jobPosting">${JSON.stringify(ld)}</script></body></html>`;
    const job = parseJobDetail(html, "1");
    expect(job?.title).toBe("Risk Manager");
  });

  test("returns null when no jobPosting JSON-LD block is present (removed/expired job)", () => {
    expect(parseJobDetail("<html><body>Job not found</body></html>", "1")).toBeNull();
  });
});
