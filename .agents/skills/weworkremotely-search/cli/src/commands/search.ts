import { SEARCH_URL, htmlFetch, parseJobCards, sortParamForJobage, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

// WWR's search endpoint returns every match in one response (no server-side
// pagination); `--page` is applied client-side over the full result set at this
// fixed page size.
const PAGE_SIZE = 20

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("term", opts.query)
  const sort = sortParamForJobage(opts.jobage)
  if (sort) params.set("sort", sort)
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const date = c.date || "—"
    return `${c.id.slice(0, 30).padEnd(31)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(31) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(24) + " " + "LOCATION".padEnd(24) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    const all = parseJobCards(html)
    const start = (opts.page - 1) * PAGE_SIZE
    let cards = all.slice(start, start + PAGE_SIZE)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, page: opts.page, total: all.length }, results: cards },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
