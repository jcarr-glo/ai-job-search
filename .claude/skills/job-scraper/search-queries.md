# Search Queries for Job Scraper

<!-- SETUP: Customize these queries based on your skills, target roles, and location -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped CLIs include `linkedin-search`, `freehire-search`, `weworkremotely-search`, and `efinancialcareers-search`; any skill you add with `/add-portal` is included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary (dedicated CLIs - no `site:` query needed, `/scrape` runs these automatically):
- **linkedin.com/jobs** - LinkedIn job listings (filter: USA / North Carolina / Remote); covered by `linkedin-search` CLI
- Also covered by the country-agnostic `freehire-search` CLI
- **efinancialcareers.com** - niche board for FinTech/capital markets leadership roles, high relevance to this profile; covered by `efinancialcareers-search` CLI. **Personal use only** - their ToS prohibits automated access even though `robots.txt` permits the endpoints used; keep volume low (see `SKILL.md` for the full warning).
- **weworkremotely.com** - remote-focused board; covered by `weworkremotely-search` CLI (clean `robots.txt` allow, no ToS restriction found)

WebSearch fallback (no dedicated CLI - `site:` queries below cover these):
- **indeed.com** - general US job board
- **dice.com** - US tech-jobs board. **No CLI was built**: `robots.txt` explicitly disallows the search-query path (`/jobs?q*`) even though detail pages are allowed, so a `/add-portal` attempt stopped at the access-rules gate rather than scaffold a ToS-violating skill.
- **ziprecruiter.com** - general US job board
- **glassdoor.com** - general job board with company reviews
- **builtin.com** - tech/startup-focused board with metro editions (BuiltIn NYC, Chicago, etc.)
- **wellfound.com** (formerly AngelList Talent) - startup-focused board, remote-friendly listings
- **theladders.com** - executive-focused board ($100k+ roles), high relevance to this profile's seniority
- **web3.career** - crypto/web3-focused board; tangential relevance given Blue Ocean's tokenized-equities/DTCC-aligned work

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies (FinTech/trading platforms, enterprise data/AI consultancies - no specific target companies confirmed yet, add here as identified)

## Query Categories

Queries are grouped by priority. Write **each category in every language from your Languages table** (see Language scope above). Combine each query with your location terms (e.g. your city, region, or metro area) where the site supports it.

### Priority 1: Data, Analytics & AI Strategy

These match your strongest and most desired career direction - Analytics, Data, and Strategy leadership.

```
site:linkedin.com/jobs "VP of Data" OR "Director of Data" AI governance
site:linkedin.com/jobs "Head of Data and Analytics" Remote
site:linkedin.com/jobs "VP of Analytics" OR "Head of Analytics" Remote
site:linkedin.com/jobs "Chief Data Officer" OR "Chief Analytics Officer"
site:linkedin.com/jobs "Enterprise AI Strategy" OR "AI Governance" leadership
site:indeed.com "data architecture" "AI strategy" North Carolina OR Remote
site:builtin.com "VP of Data" OR "Head of Data" Remote
site:efinancialcareers.com "VP of Data" OR "Head of Analytics" OR "Chief Data Officer"
site:theladders.com "VP of Analytics" OR "Chief Data Officer" Remote
```

### Priority 2: Product

These match your Product strength - especially data-product and platform-product framing, where Product overlaps with your data and analytics background.

```
site:linkedin.com/jobs "VP of Product" OR "Head of Product" data OR analytics
site:linkedin.com/jobs "Director of Product" "data platform" OR "data products"
site:linkedin.com/jobs "VP of Product" FinTech OR trading
site:indeed.com "VP of Product" "data platform" Remote
site:theladders.com "VP of Product" OR "Head of Product" Remote
```

### Priority 3: Technology Executive (CTO / Head of Technology / VP Engineering)

Real experience (Blue Ocean) but a secondary direction relative to Data, Analytics, Strategy, and Product.

```
site:linkedin.com/jobs "Chief Technology Officer" Remote
site:linkedin.com/jobs "Head of Technology" FinTech
site:linkedin.com/jobs "VP of Engineering" trading OR FinTech
site:indeed.com "Chief Technology Officer" "North Carolina" OR Remote
site:theladders.com "Chief Technology Officer" OR "Head of Technology" Remote
site:ziprecruiter.com "VP of Engineering" FinTech OR Remote
site:glassdoor.com "Chief Technology Officer" Remote
site:dice.com "Chief Technology Officer" OR "VP Engineering"
site:efinancialcareers.com "Head of Technology" OR "Chief Technology Officer"
```

### Priority 4: Data, SQL, Reporting & Fractional CTO

Broader net combining hands-on data roles (SQL, BI/reporting, analytics work drawing on your Tableau/Power BI, SQL, and data architecture background) with fractional/consulting CTO roles you could pivot into.

```
site:linkedin.com/jobs "Data Analyst" OR "BI Analyst" SQL Remote
site:linkedin.com/jobs "Reporting Analyst" OR "Business Intelligence" Tableau OR "Power BI"
site:linkedin.com/jobs "SQL Developer" OR "Data Engineer" Remote
site:theladders.com "Director of Reporting" OR "Head of Business Intelligence" Remote
site:linkedin.com/jobs "Fractional CTO" OR "Technology Consultant" FinTech
site:wellfound.com "Fractional CTO" OR "Technology Advisor" Remote
```

### Priority 5: Broader Capital Markets / FinTech Technology

Wider net for general technical leadership roles in regulated finance. Runs only on `/scrape broad`.

```
site:linkedin.com/jobs "trading infrastructure" leadership Remote
site:linkedin.com/jobs "Alternative Trading System" OR ATS technology leadership
site:indeed.com "capital markets" "technology leadership" Remote
site:web3.career "Chief Technology Officer" OR "Head of Technology" tokenization OR trading
```

## Location Filter

No location constraints - the candidate is willing to relocate anywhere (domestic or international) for the right role, and remote is also fine. Do not filter or flag results by location; evaluate purely on role fit.

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
