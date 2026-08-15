import {
  loadCompanies,
  findCompany,
  fetchCompanyJobs,
  parseDetailUrl,
  writeError,
  type Company,
  type JobCard,
} from "../helpers.js"

export interface DetailOpts {
  idOrUrl: string
  company?: string
  ats?: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  let company: Company | null = null
  let jobId: string

  const parsed = parseDetailUrl(opts.idOrUrl)
  if (parsed) {
    const registryHit = findCompany(loadCompanies(), parsed.slug)
    company = registryHit ?? { name: parsed.slug, ats: parsed.ats, slug: parsed.slug, careers_url: opts.idOrUrl }
    jobId = parsed.id
  } else {
    jobId = opts.idOrUrl
    if (!opts.company) {
      writeError(
        "detail needs either a full posting URL, or a bare id plus --company <slug> (and --ats if the company isn't in the registry)",
        "NO_COMPANY",
      )
      return 1
    }
    const registryHit = findCompany(loadCompanies(), opts.company)
    if (registryHit) {
      company = registryHit
    } else if (opts.ats === "greenhouse" || opts.ats === "lever" || opts.ats === "ashby") {
      company = { name: opts.company, ats: opts.ats, slug: opts.company }
    } else {
      writeError(`"${opts.company}" isn't in the registry - pass --ats greenhouse|lever|ashby for an unlisted company`, "UNKNOWN_COMPANY")
      return 1
    }
  }

  try {
    const jobs: JobCard[] = await fetchCompanyJobs(company, { content: true })
    const job = jobs.find((j) => j.id === jobId)
    if (!job) {
      writeError(`No job with id "${jobId}" found on ${company.name}'s board`, "NOT_FOUND")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company} · ${job.location || "—"} · ${job.ats}`,
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ]
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
