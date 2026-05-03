// Diagnostic: do one real search on TM-Search and dump everything we
// can see — DOM structure, captured network responses, screenshot.
// Use this to design the result-extraction logic in uspto-search.ts.
import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const QUERY = process.argv[2] || "backflo";

async function main() {
  const outDir = path.join(process.cwd(), "scripts", ".uspto-out");
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  // Capture XHR / fetch responses so we can see what the SPA loads.
  const apiResponses: Array<{ url: string; status: number; bodySnippet: string }> =
    [];
  page.on("response", async (res) => {
    const url = res.url();
    const ctype = res.headers()["content-type"] || "";
    if (
      ctype.includes("json") ||
      url.includes("/api/") ||
      url.includes("/search")
    ) {
      try {
        const text = await res.text();
        apiResponses.push({
          url,
          status: res.status(),
          bodySnippet: text.slice(0, 500),
        });
      } catch {
        /* ignore */
      }
    }
  });

  console.log(`Querying TM-Search for "${QUERY}"`);
  await page.goto("https://tmsearch.uspto.gov/search/search-information", {
    waitUntil: "domcontentloaded",
  });

  await page.locator("#searchbar").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#searchbar").click();
  await page.locator("#searchbar").fill(QUERY);
  await page.keyboard.press("Enter");

  // Wait long for results — USPTO TM-Search is slow to render.
  console.log("  waiting for results...");
  await page
    .waitForLoadState("networkidle", { timeout: 60_000 })
    .catch(() => console.log("  networkidle timeout (ok)"));
  await page.waitForTimeout(5000);

  console.log(`  current url: ${page.url()}`);

  const html = await page.content();
  const text = await page.evaluate(() => document.body.innerText);
  await fs.writeFile(path.join(outDir, "results.html"), html);
  await fs.writeFile(path.join(outDir, "results.txt"), text);
  await fs.writeFile(
    path.join(outDir, "results_api.json"),
    JSON.stringify(apiResponses, null, 2),
  );
  await page.screenshot({
    path: path.join(outDir, "results.png"),
    fullPage: true,
  });

  // Try to enumerate plausible result containers.
  // Inline the snapshot helper as an array map to avoid tsx's __name
  // serialization pitfall inside page.evaluate.
  const selectors = [
    "table",
    "table tbody tr",
    "[role='row']",
    "[role='grid']",
    "[role='gridcell']",
    "[data-result]",
    ".result",
    ".result-card",
    "article",
    "li",
    "a[href*='/search/']",
    "a[href*='trademark']",
  ];
  const structure = await page.evaluate((sels) => {
    return sels.map((sel) => {
      const els = document.querySelectorAll(sel);
      return {
        selector: sel,
        count: els.length,
        first: els[0]
          ? (els[0] as HTMLElement).outerHTML.slice(0, 800)
          : null,
      };
    });
  }, selectors);

  console.log("\n--- result-container probes ---");
  for (const s of structure) {
    if (s.count > 0) {
      console.log(`  ${s.selector}: ${s.count}`);
      if (s.first) {
        console.log(`    first[:200]: ${s.first.slice(0, 200).replace(/\s+/g, " ")}`);
      }
    }
  }

  console.log(`\n--- text length ${text.length}, captured ${apiResponses.length} API responses ---`);
  console.log(`text[:1500]:\n${text.slice(0, 1500)}\n`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
