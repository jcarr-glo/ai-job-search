import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("cli flag validation", () => {
  test("no command prints help and exits 1", async () => {
    const result = await runCLI([])
    expect(result.exitCode).toBe(1)
  })

  test("unknown command exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["bogus-command"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("BAD_CMD")
  })

  test("search with invalid --ats exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--ats", "not-a-real-ats"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("BAD_ARG")
  })

  test("search with non-numeric --jobage exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--jobage", "not-a-number"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("BAD_ARG")
  })

  test("search scoped to an unknown company exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--company", "definitely-not-a-real-company-slug"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("UNKNOWN_COMPANY")
  })

  test("detail without an id exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["detail"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("NO_ID")
  })

  test("detail with a bare id and no --company exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["detail", "12345"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("NO_COMPANY")
  })
})
