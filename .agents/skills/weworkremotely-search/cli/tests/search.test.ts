import { afterEach, describe, expect, test } from "bun:test";
import { runSearch } from "../src/commands/search";

const originalFetch = globalThis.fetch;
const originalStdoutWrite = process.stdout.write;

function searchCard(id: string, title: string): string {
  return `<li class=" new-listing-container "><div class=" "></div><div class="tooltip--flag-logo"><a href="/company/acme"></a></div><a class="listing-link--unlocked" href="/remote-jobs/${id}"><div class=" new-listing "><div class="new-listing__header"><h3 class="new-listing__header__title"><span class="new-listing__header__title__text">${title}</span></h3><div class=" new-listing__header__icons "><p class="new-listing__header__icons__date"> 3d </p></div></div><p class="new-listing__company-name"> Acme </p><p class="new-listing__company-headquarters"> Remote </p><div class="new-listing__categories"><p class="new-listing__categories__category">Full-Time</p><p class="new-listing__categories__category">Anywhere in the World</p></div></div></a></li>`;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.stdout.write = originalStdoutWrite;
});

describe("runSearch", () => {
  test("--limit 0 emits zero results", async () => {
    globalThis.fetch = (async () => new Response(searchCard("job-1", "Engineer"))) as typeof fetch;

    let stdout = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout += chunk.toString();
      return true;
    }) as typeof process.stdout.write;

    const code = await runSearch({ jobage: 9999, page: 1, limit: 0, format: "json" });

    expect(code).toBe(0);
    expect(JSON.parse(stdout).results).toHaveLength(0);
  });

  test("builds the request with term and sort params", async () => {
    let capturedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      return new Response("");
    }) as typeof fetch;

    const code = await runSearch({ query: "engineering manager", jobage: 7, page: 1, format: "json" });

    expect(code).toBe(0);
    const url = new URL(capturedUrl);
    expect(url.searchParams.get("term")).toBe("engineering manager");
    expect(url.searchParams.get("sort")).toBe("Past Week");
  });

  test("omits the sort param when jobage is unset (Any Time)", async () => {
    let capturedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = typeof input === "string" ? input : input.toString();
      return new Response("");
    }) as typeof fetch;

    await runSearch({ jobage: 9999, page: 1, format: "json" });

    expect(new URL(capturedUrl).searchParams.has("sort")).toBe(false);
  });

  test("paginates client-side across the full parsed result set", async () => {
    const cards = Array.from({ length: 25 }, (_, i) => searchCard(`job-${i}`, `Job ${i}`)).join("");
    globalThis.fetch = (async () => new Response(cards)) as typeof fetch;

    let stdout = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout += chunk.toString();
      return true;
    }) as typeof process.stdout.write;

    const codePage1 = await runSearch({ jobage: 9999, page: 1, format: "json" });
    const page1 = JSON.parse(stdout);
    stdout = "";
    const codePage2 = await runSearch({ jobage: 9999, page: 2, format: "json" });
    const page2 = JSON.parse(stdout);

    expect(codePage1).toBe(0);
    expect(codePage2).toBe(0);
    expect(page1.meta.total).toBe(25);
    expect(page1.results).toHaveLength(20);
    expect(page2.results).toHaveLength(5);
    expect(page1.results[0].id).toBe("job-0");
    expect(page2.results[0].id).toBe("job-20");
  });
});
