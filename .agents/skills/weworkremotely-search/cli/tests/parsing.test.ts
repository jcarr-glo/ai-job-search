import { describe, test, expect } from "bun:test";
import {
  parseJobCards,
  parseJobDetail,
  looksLikeJobPostingPage,
  relativeDateToISO,
  cleanLdDescription,
  sortParamForJobage,
} from "../src/helpers";

// Minimal search-card markup mirroring the real WWR structure: a
// `new-listing-container` <li> wrapping a `listing-link--unlocked` <a> with the
// title, company, headquarters, date, and category tags.
function searchCard(opts: {
  slug: string;
  title: string;
  company?: string;
  headquarters?: string;
  dateText?: string; // e.g. "8d" or omit for a <span class="new">New</span>
  categories?: string[];
}): string {
  const company = opts.company ?? "Acme";
  const hq = opts.headquarters ?? "Remote";
  const dateHtml =
    opts.dateText === undefined
      ? `<span class="new">New</span>`
      : opts.dateText;
  const cats = (opts.categories ?? ["Full-Time", "Anywhere in the World"])
    .map((c) => `<p class="new-listing__categories__category">${c}</p>`)
    .join("");
  return `<li class=" new-listing-container "><div class=" "></div><div class="tooltip--flag-logo"><a href="/company/${company.toLowerCase()}"><span class="tooltip--flag-logo__tooltiptext">View Company Profile</span></a></div><a class="listing-link--unlocked" href="/remote-jobs/${opts.slug}"><div class=" new-listing "><div class="new-listing__header"><h3 class="new-listing__header__title"><span class="new-listing__header__title__text">${opts.title}</span></h3><div class=" new-listing__header__icons paid-logo "><p class="new-listing__header__icons__date">${dateHtml}</p></div></div><p class="new-listing__company-name"> ${company} <img alt="" src="x.svg"/></p><p class="new-listing__company-headquarters"> ${hq} <i class="fa-solid fa-location-dot"></i></p><div class="new-listing__categories">${cats}</div></div></a></li>`;
}

describe("parseJobCards", () => {
  test("extracts id, title, company, location, date, url from a real-shaped card", () => {
    const html = searchCard({
      slug: "lattice-engineering-manager-ai-1",
      title: "Engineering Manager, AI",
      company: "Lattice",
      headquarters: "San Francisco, California, USA",
      dateText: " 5d ",
    });
    const [card] = parseJobCards(html);
    expect(card.id).toBe("lattice-engineering-manager-ai-1");
    expect(card.title).toBe("Engineering Manager, AI");
    expect(card.company).toBe("Lattice");
    expect(card.companyUrl).toBe("https://weworkremotely.com/company/lattice");
    expect(card.location).toBe("San Francisco, California, USA");
    expect(card.url).toBe("https://weworkremotely.com/remote-jobs/lattice-engineering-manager-ai-1");
    expect(card.employmentType).toBe("Full-Time");
    expect(card.region).toBe("Anywhere in the World");
  });

  test("converts a 'New' date span to today's ISO date", () => {
    const html = searchCard({ slug: "x-new-job", title: "New Job" });
    const [card] = parseJobCards(html);
    expect(card.date).toBe(new Date().toISOString().slice(0, 10));
  });

  test("decodes HTML entities in title and company", () => {
    const html = searchCard({
      slug: "obrien-role",
      title: "Design Project Manager (Estonia)",
      company: "Salas O&#39;Brien",
    });
    const [card] = parseJobCards(html);
    expect(card.company).toBe("Salas O'Brien");
  });

  test("filters out a 'Top 100' badge entry ahead of the real category tags", () => {
    const html = searchCard({
      slug: "top-co-job",
      title: "Data Engineering Manager",
      categories: ["Top 100", "Full-Time", "Anywhere in the World"],
    });
    const [card] = parseJobCards(html);
    expect(card.employmentType).toBe("Full-Time");
    expect(card.region).toBe("Anywhere in the World");
  });

  test("skips a sponsored listing-ad entry that lacks the new-listing-container class", () => {
    const ad = `<li id="listing-ad-13" class="feature feature-listing-ad listing-ad--listing-card"><a href="/listing_ads/13/click">Sponsored</a></li>`;
    const real = searchCard({ slug: "real-job", title: "Real Job" });
    const cards = parseJobCards(ad + real);
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe("real-job");
  });

  test("empty search page yields zero results without throwing", () => {
    expect(parseJobCards("<html><body>no jobs</body></html>")).toEqual([]);
  });

  test("a malformed card (no title) is skipped without breaking the next one", () => {
    const broken = `new-listing-container "><a class="listing-link--unlocked" href="/remote-jobs/broken"></a></li>`;
    const real = searchCard({ slug: "ok-job", title: "OK Job" });
    const cards = parseJobCards(broken + real);
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe("ok-job");
  });
});

describe("relativeDateToISO", () => {
  test("converts 'Nd' to an ISO date N days ago", () => {
    const expected = new Date();
    expected.setUTCDate(expected.getUTCDate() - 8);
    expect(relativeDateToISO("8d")).toBe(expected.toISOString().slice(0, 10));
  });

  test("'New' maps to today", () => {
    expect(relativeDateToISO("New")).toBe(new Date().toISOString().slice(0, 10));
  });

  test("empty or unrecognized text returns null", () => {
    expect(relativeDateToISO("")).toBeNull();
    expect(relativeDateToISO(null)).toBeNull();
    expect(relativeDateToISO("3 weeks ago")).toBeNull();
  });
});

describe("sortParamForJobage", () => {
  test("rounds up to the nearest WWR bucket", () => {
    expect(sortParamForJobage(1)).toBe("Past 24 Hours");
    expect(sortParamForJobage(3)).toBe("Past Week");
    expect(sortParamForJobage(7)).toBe("Past Week");
    expect(sortParamForJobage(10)).toBe("Past 2 Weeks");
    expect(sortParamForJobage(14)).toBe("Past 2 Weeks");
  });

  test("beyond 14 days or unset omits the filter", () => {
    expect(sortParamForJobage(30)).toBeNull();
    expect(sortParamForJobage(undefined)).toBeNull();
    expect(sortParamForJobage(9999)).toBeNull();
    expect(sortParamForJobage(0)).toBeNull();
  });
});

describe("looksLikeJobPostingPage", () => {
  test("true when the schema.org JobPosting block is present", () => {
    const html = `<script type="application/ld+json">{"@type" : "JobPosting"}</script>`;
    expect(looksLikeJobPostingPage(html)).toBe(true);
  });

  test("false on a redirected homepage (the bogus-slug case)", () => {
    expect(looksLikeJobPostingPage("<html><body>We Work Remotely homepage</body></html>")).toBe(false);
  });
});

describe("parseJobDetail", () => {
  function ldJsonPage(fields: Record<string, string>): string {
    const body = Object.entries(fields)
      .map(([k, v]) => `"${k}" : "${v}"`)
      .join(",\n    ");
    return `<html><body><a href="/company/lattice">Lattice</a><script type="application/ld+json"> {
    "@context" : "http://schema.org/",
    "@type" : "JobPosting",
    ${body},
    "hiringOrganization" : {
      "@type" : "Organization",
      "name" : "Lattice",
      "address": "Remote - Canada",
      "sameAs" : "https://weworkremotely.com"
    },
    "identifier": {
      "@type": "PropertyValue",
      "name": "Lattice",
      "value": "lattice-engineering-manager-ai-1"
    }
  }
  </script></body></html>`;
  }

  test("extracts title, company, location, employmentType, date from the JSON-LD block", () => {
    const html = ldJsonPage({
      title: "Engineering Manager, AI",
      employmentType: "Full-Time",
      datePosted: "2026-08-08 07:30:54 UTC",
      validThrough: "2026-09-07 07:30:54 UTC",
      description: "Build things.",
    });
    const job = parseJobDetail(html, "lattice-engineering-manager-ai-1");
    expect(job.title).toBe("Engineering Manager, AI");
    expect(job.company).toBe("Lattice");
    expect(job.location).toBe("Remote - Canada");
    expect(job.employmentType).toBe("Full-Time");
    expect(job.date).toBe("2026-08-08");
    expect(job.validThrough).toBe("2026-09-07");
    expect(job.companyUrl).toBe("https://weworkremotely.com/company/lattice");
    expect(job.applyUrl).toBeNull();
    expect(job.url).toBe("https://weworkremotely.com/remote-jobs/lattice-engineering-manager-ai-1");
  });

  test("description is decoded from the HTML-entity-escaped JSON-LD string", () => {
    const html = ldJsonPage({
      title: "Role",
      datePosted: "2026-08-08 07:30:54 UTC",
      description:
        "&lt;p&gt;&lt;strong&gt;Location Requirement:&lt;/strong&gt;&lt;br&gt;Remote only.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Own the roadmap&lt;/li&gt;&lt;/ul&gt;",
    });
    const job = parseJobDetail(html, "role");
    expect(job.description).toContain("Location Requirement:");
    expect(job.description).toContain("Remote only.");
    expect(job.description).toContain("Own the roadmap");
    expect(job.description).not.toContain("<p>");
    expect(job.description).not.toContain("&lt;");
  });
});

describe("cleanLdDescription", () => {
  test("resolves double-escaped entities from the WWR escaping quirk", () => {
    // Raw HTML "AD&amp;D" gets HTML-escaped a second time into "AD&amp;amp;D"
    // when embedded in the JSON-LD block.
    const raw = "&lt;p&gt;Benefits include AD&amp;amp;D insurance.&lt;/p&gt;";
    expect(cleanLdDescription(raw)).toBe("Benefits include AD&D insurance.");
  });

  test("null/empty input yields null", () => {
    expect(cleanLdDescription(null)).toBeNull();
    expect(cleanLdDescription("")).toBeNull();
  });

  test("preserves paragraph breaks as newlines", () => {
    const raw = "&lt;p&gt;First.&lt;/p&gt;&lt;p&gt;Second.&lt;/p&gt;";
    expect(cleanLdDescription(raw)).toBe("First.\nSecond.");
  });
});
