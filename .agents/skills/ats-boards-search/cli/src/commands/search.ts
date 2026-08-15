import {
  loadCompanies,
  findCompany,
  fetchCompanyJobs,
  mapWithConcurrency,
  writeError,
  type Company,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  company?: string
  ats?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const PAGE_SIZE = 25
const CONCURRENCY = 8

function matchesQuery(job: JobCard, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  // Title-only on purpose: these queries are role/seniority terms (e.g. "head of
  // data", "chief technology officer") and matching against the full description
  // too would pass almost any senior-role posting, since long descriptions tend to
  // contain most query words somewhere regardless of the role's actual title.
  const haystack = job.title.toLowerCase()
  return terms.every((t) => haystack.includes(t))
}

function matchesLocation(job: JobCard, location: string): boolean {
  return (job.location ?? "").toLowerCase().includes(location.toLowerCase())
}

function withinJobAge(job: JobCard, days: number): boolean {
  if (!days || days >= 9999) return true
  if (!job.date) return true // unknown date - never discard, can't determine
  const cutoff = Date.now() - days * 86400 * 1000
  const ts = Date.parse(job.date)
  if (isNaN(ts)) return true
  return ts >= cutoff
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 38).padEnd(38)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const ats = c.ats.padEnd(10)
    const date = c.date || "—"
    return `${title} ${company} ${loc} ${ats} ${date}`
  })
  const header =
    "TITLE".padEnd(38) + " " + "COMPANY".padEnd(22) + " " + "LOCATION".padEnd(20) + " " + "ATS".padEnd(10) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const all = loadCompanies()
    if (all.length === 0) {
      writeError("Company registry (companies.json) is empty or missing", "NO_COMPANIES")
      return 1
    }

    let targets: Company[]
    if (opts.company) {
      const c = findCompany(all, opts.company)
      if (!c) {
        writeError(`No company with slug "${opts.company}" in the registry`, "UNKNOWN_COMPANY")
        return 1
      }
      targets = [c]
    } else if (opts.ats) {
      targets = all.filter((c) => c.ats === opts.ats)
      if (targets.length === 0) {
        writeError(`No companies with ats "${opts.ats}" in the registry`, "UNKNOWN_ATS")
        return 1
      }
    } else {
      targets = all
    }

    // Greenhouse needs an explicit content=true fetch to get descriptions; only pay
    // that cost when scoped to a single company (a full-registry sweep stays light).
    const withContent = targets.length === 1
    const perCompany = await mapWithConcurrency(targets, CONCURRENCY, (c) =>
      fetchCompanyJobs(c, { content: withContent }).catch(() => [] as JobCard[]),
    )
    let jobs = perCompany.flat()

    if (opts.query) jobs = jobs.filter((j) => matchesQuery(j, opts.query!))
    if (opts.location) jobs = jobs.filter((j) => matchesLocation(j, opts.location!))
    jobs = jobs.filter((j) => withinJobAge(j, opts.jobage))

    jobs.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date)
      if (a.date) return -1
      if (b.date) return 1
      return 0
    })

    // No server-side pagination exists across these APIs (each call returns a
    // company's full list) - --page/--limit are applied client-side over the
    // merged, sorted results.
    const start = (opts.page - 1) * PAGE_SIZE
    let page = jobs.slice(start, start + PAGE_SIZE)
    if (opts.limit !== undefined && opts.limit >= 0) page = page.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(page) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        page
          .map(
            (c) =>
              `${c.title}\n  ${c.company} · ${c.location || "—"} · ${c.date || "—"} · ${c.ats}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: page.length, page: opts.page, totalMatched: jobs.length }, results: page }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
