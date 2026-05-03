// USPTO TM-Search probe for "BackFLO" + neighbors. Captures the
// results-list text for each query and saves it for parsing. We rely
// on the rendered text rather than DOM scraping because TM-Search's
// DOM is unstable across releases — text-extraction is more durable.
//
// Run: `npx tsx scripts/uspto-search.ts`
//
// Output: scripts/.uspto-out/<query>.txt (results page text), .png
// (full-page screenshot), and summary.json with counts.

import { chromium, type Page } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const QUERIES: Array<{ q: string; note: string }> = [
  { q: "psipoint", note: "exact mark — primary risk vector" },
  { q: "psi point", note: "exact with space" },
  { q: "psi-point", note: "exact with hyphen" },
  { q: "sipoint", note: "phonetic without leading P" },
  { q: "psypoint", note: "phonetic neighbor (psy-)" },
  { q: "sigh point", note: "phonetic spelled out" },
];

type QueryResult = {
  query: string;
  note: string;
  url: string;
  textLength: number;
  resultCountHint: string | null;
  liveCountHint: string | null;
  hits: Array<{
    serial?: string;
    mark?: string;
    status?: string;
    class?: string;
    owner?: string;
    goodsServices?: string;
  }>;
};

// Parse the results text into per-result blocks. TM-Search renders
// each hit with a stable header/footer — "Check to tag for <serial>"
// opens a block, "Owners" closes it. Worth being defensive about
// missing fields; the SPA sometimes hides a column behind a toggle.
function parseResults(text: string): QueryResult["hits"] {
  const hits: QueryResult["hits"] = [];
  const blocks = text.split(/Check to tag for\s+/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const grab = (label: string, end: RegExp) => {
      const re = new RegExp(`${label}\\s*([\\s\\S]*?)${end.source}`, "i");
      const m = block.match(re);
      return m ? m[1].trim() : undefined;
    };
    const serialMatch = block.match(/^(\d{6,})/);
    const mark = grab("wordmark", /\nStatus/);
    const status = grab("Status", /\n(Goods|Class|Serial|Owners|$)/);
    const goodsServices = grab("Goods & services", /\n(Class|outbound)/);
    const cls = grab("Class", /\nSerial/);
    const owner = grab("Owners", /\n(Check to tag for|\d+ per page|first_page|$)/);
    hits.push({
      serial: serialMatch?.[1],
      mark: mark?.split("\n")[0]?.trim(),
      status: status?.replace(/\s+/g, " ").trim(),
      class: cls?.split("\n")[0]?.trim(),
      owner: owner?.split("\n")[0]?.trim(),
      goodsServices: goodsServices?.replace(/\s+/g, " ").trim(),
    });
  }
  return hits;
}

async function searchOne(
  page: Page,
  q: string,
  note: string,
  outDir: string,
): Promise<QueryResult> {
  console.log(`\n--- "${q}" (${note}) ---`);
  await page.goto("https://tmsearch.uspto.gov/search/search-information", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.locator("#searchbar").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#searchbar").click();
  // Clear before fill in case a prior value lingers.
  await page.locator("#searchbar").fill("");
  await page.locator("#searchbar").fill(q);
  await page.keyboard.press("Enter");

  // Be patient — USPTO results render is slow and JS-heavy.
  await page
    .waitForLoadState("networkidle", { timeout: 60_000 })
    .catch(() => {});
  await page.waitForTimeout(5000);

  const text = await page.evaluate(() => document.body.innerText);
  const safeQ = q.replace(/[^a-z0-9]+/gi, "_");
  await fs.writeFile(path.join(outDir, `${safeQ}.txt`), text);
  await page.screenshot({
    path: path.join(outDir, `${safeQ}.png`),
    fullPage: true,
  });

  // Pull the count hint TM-Search prints at the top.
  const resultCountHint =
    text.match(/(\d+)\s+results? for\s+/i)?.[0] ?? null;
  const liveCountHint = (() => {
    // After "Live" / "A live trademark filing is active" the next
    // line is the count.
    const m = text.match(/Live\s*\n\s*A live trademark filing is active\s*\n\s*(\d+)/);
    return m ? `Live: ${m[1]}` : null;
  })();

  const hits = parseResults(text);
  console.log(
    `  url: ${page.url()}\n  text length: ${text.length} | hint: ${resultCountHint} | ${liveCountHint} | parsed hits: ${hits.length}`,
  );

  return {
    query: q,
    note,
    url: page.url(),
    textLength: text.length,
    resultCountHint,
    liveCountHint,
    hits,
  };
}

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

  const results: QueryResult[] = [];

  for (const { q, note } of QUERIES) {
    try {
      results.push(await searchOne(page, q, note, outDir));
    } catch (err) {
      console.error(`  query "${q}" failed:`, (err as Error).message);
      results.push({
        query: q,
        note,
        url: "",
        textLength: 0,
        resultCountHint: null,
        liveCountHint: null,
        hits: [],
      });
    }
  }

  await fs.writeFile(
    path.join(outDir, "summary.json"),
    JSON.stringify(results, null, 2),
  );

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`  "${r.query}" — ${r.resultCountHint ?? "(no count)"}`);
    if (r.liveCountHint) console.log(`    ${r.liveCountHint}`);
    for (const h of r.hits) {
      console.log(
        `    • ${h.serial ?? "?"}  ${h.mark ?? "?"}  [${h.status ?? "?"}]  cls=${h.class ?? "?"}  owner=${h.owner ?? "?"}`,
      );
      if (h.goodsServices) console.log(`        gs: ${h.goodsServices}`);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
