#!/usr/bin/env bun
// Self-contained CLI that searches the public JSON job-board APIs behind
// Greenhouse, Lever, and Ashby across a curated registry of mid/small fintech and
// capital-markets companies (companies.json). No external CLI framework, so it
// runs anywhere `bun` is available with zero install beyond the repo clone.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { loadCompanies, writeError } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `ats-boards-cli — search job postings across mid/small fintech companies'
Greenhouse, Lever, and Ashby career boards (companies.json registry)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <url|id> [--company <slug>] [--ats <ats>] [--format json|plain]
  bun run src/cli.ts list-companies [--format json|table]

SEARCH FLAGS
  --query, -q <text>      Keywords - matched against title/location/description. Optional.
  --company <slug>        Scope to one company's board (slug from companies.json).
  --ats <ats>             Scope to one ATS: greenhouse | lever | ashby.
  --location, -l <text>   Client-side substring filter on the job's location field.
  --jobage <days>         Posted within N days. Default: all.
  --page <n>              1-indexed page over the merged, sorted results (25/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side, applied after paging).
  --format <fmt>          json (default) | table | plain.

DETAIL
  <url>                   A full posting URL (Greenhouse/Lever/Ashby) - self-sufficient.
  <id> --company <slug>   A bare job id plus the company slug (looked up in the registry).
  --ats <ats>             Required with --company only when the company isn't in companies.json.

EXAMPLES
  bun run src/cli.ts search -q "chief technology officer" --format table
  bun run src/cli.ts search -q "head of data" --ats greenhouse --jobage 14 --format table
  bun run src/cli.ts search --company ramp --format table
  bun run src/cli.ts detail https://job-boards.greenhouse.io/kalshi/jobs/1234567 --format plain
  bun run src/cli.ts list-companies --format table

No authentication, zero runtime dependencies. These are the ATS vendors' own public
job-board APIs (no ToS restriction like a scraped HTML page) - full company/ATS/slug
list lives in companies.json.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        writeError(`--${name} must be a number, got "${raw}"`, "BAD_ARG")
        return null
      }
      return val
    }

    let jobage = 9999
    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      jobage = v
    }
    let page = 1
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      page = Math.max(1, v)
    }
    let limit: number | undefined
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      limit = v
    }
    if (flags.ats !== undefined && !["greenhouse", "lever", "ashby"].includes(flags.ats as string)) {
      writeError(`--ats must be one of greenhouse|lever|ashby, got "${flags.ats}"`, "BAD_ARG")
      return 1
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      company: typeof flags.company === "string" ? flags.company : undefined,
      ats: typeof flags.ats === "string" ? flags.ats : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      jobage,
      page,
      limit,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const idOrUrl = (flags._ as string[])[1]
    if (!idOrUrl) {
      writeError("detail requires an <id|url>", "NO_ID")
      return 1
    }
    if (flags.ats !== undefined && !["greenhouse", "lever", "ashby"].includes(flags.ats as string)) {
      writeError(`--ats must be one of greenhouse|lever|ashby, got "${flags.ats}"`, "BAD_ARG")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      idOrUrl,
      company: typeof flags.company === "string" ? flags.company : undefined,
      ats: typeof flags.ats === "string" ? flags.ats : undefined,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  if (cmd === "list-companies") {
    const fmt = (flags.format as string) || "json"
    const companies = loadCompanies()
    if (fmt === "table") {
      const header = "NAME".padEnd(28) + " " + "ATS".padEnd(11) + " " + "SLUG".padEnd(26) + " SECTOR"
      const rows = companies.map(
        (c) => `${c.name.slice(0, 28).padEnd(28)} ${c.ats.padEnd(11)} ${c.slug.slice(0, 26).padEnd(26)} ${c.sector ?? "—"}`,
      )
      process.stdout.write([header, "-".repeat(header.length), ...rows].join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify({ meta: { count: companies.length }, results: companies }, null, 2) + "\n")
    }
    return 0
  }

  writeError(`Unknown command "${cmd}"`, "BAD_CMD")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        code: "INTERNAL_ERROR",
      }) + "\n",
    )
    process.exit(1)
  })
