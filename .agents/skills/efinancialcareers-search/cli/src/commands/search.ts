import {
  SEARCH_BASE_URL,
  htmlFetch,
  parseJobCards,
  querySlug,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query: string
  location?: string
  jobage?: number // posted within N days; filtered client-side (see helpers.ts notes)
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function buildUrl(opts: SearchOpts): string {
  const slug = querySlug(opts.query)
  const params = new URLSearchParams()
  if (opts.location) params.set("location", opts.location)
  if (opts.page > 1) params.set("page", String(opts.page))
  const qs = params.toString()
  return `${SEARCH_BASE_URL}/${slug}${qs ? `?${qs}` : ""}`
}

/** eFinancialCareers has no working server-side "posted within N days" filter
 * on this route, so --jobage is applied client-side against the (approximate)
 * relative-age date on each card in the fetched page only. */
function filterByAge(cards: JobCard[], jobage: number | undefined): JobCard[] {
  if (!jobage || jobage <= 0 || jobage >= 9999) return cards
  const cutoff = Date.now() - jobage * 86400000
  return cards.filter((c) => {
    if (!c.date) return true // unknown age — keep rather than silently drop
    const t = Date.parse(c.date)
    return isNaN(t) || t >= cutoff
  })
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const date = c.date ? c.date.slice(0, 10) : "—"
    return `${c.id.padEnd(12)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(12) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(26) +
    " " +
    "LOCATION".padEnd(24) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    let cards = parseJobCards(html)
    cards = filterByAge(cards, opts.jobage)
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
          { meta: { count: cards.length, page: opts.page }, results: cards },
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
