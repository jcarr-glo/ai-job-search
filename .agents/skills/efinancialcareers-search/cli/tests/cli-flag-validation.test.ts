import { describe, test, expect } from "bun:test";
import { runCLI } from "./helpers";

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr);
  } catch {
    return {};
  }
}

describe("eFinancialCareers CLI flag validation", () => {
  describe("missing required --query", () => {
    test("exits 1 with NO_QUERY", async () => {
      const result = await runCLI(["search"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("NO_QUERY");
    });
  });

  describe("--jobage validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "-q", "analyst", "--jobage", "foo"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("BAD_ARG");
      expect(err.error).toMatch(/jobage/);
    });

    test("boolean flag (no value) exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "-q", "analyst", "--jobage"]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    });
  });

  describe("--page validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "-q", "analyst", "--page", "abc"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("BAD_ARG");
      expect(err.error).toMatch(/page/);
    });
  });

  describe("--limit validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "-q", "analyst", "--limit", "xyz"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("BAD_ARG");
      expect(err.error).toMatch(/limit/);
    });
  });

  describe("detail missing id", () => {
    test("exits 1 with NO_ID", async () => {
      const result = await runCLI(["detail"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("NO_ID");
    });
  });

  describe("detail with unparsable id", () => {
    test("exits 1 with BAD_ID", async () => {
      const result = await runCLI(["detail", "not-a-valid-id"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("BAD_ID");
    });
  });

  describe("unknown command", () => {
    test("exits 1 with BAD_CMD", async () => {
      const result = await runCLI(["bogus"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("BAD_CMD");
    });
  });
});
