import { DETAIL_BASE_URL, htmlFetch, looksLikeJobPostingPage, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw job slug or a full/partial /remote-jobs/<slug> URL. */
function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const url = trimmed.match(/remote-jobs\/([^/?#]+)/)
  if (url) return url[1]
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return trimmed
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job slug from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await htmlFetch(`${DETAIL_BASE_URL}/${id}`)
    // An unknown/expired slug redirects to the homepage with a 200 rather than a
    // 404, so status code can't tell us "not found" — the JobPosting schema block
    // can.
    if (!html || !looksLikeJobPostingPage(html)) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.validThrough ? `Valid through: ${job.validThrough}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        "Apply: sign in to weworkremotely.com to view the direct apply link",
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
