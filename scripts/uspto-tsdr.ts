// Hit TSDR (Trademark Status & Document Retrieval) per serial number
// via a real browser — the JSON API blocks unauthenticated curl, but
// the HTML page works once JS runs.
import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const SERIALS = ["86702851", "99607554"];

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

  for (const serial of SERIALS) {
    console.log(`\n--- TSDR ${serial} ---`);
    const url = `https://tsdr.uspto.gov/#caseNumber=${serial}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      // TSDR is a heavy SPA — wait long.
      await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(8000);
      const text = await page.evaluate(() => document.body.innerText);
      console.log(`  url: ${page.url()}\n  text length: ${text.length}`);
      await fs.writeFile(path.join(outDir, `tsdr_${serial}.txt`), text);
      await page.screenshot({
        path: path.join(outDir, `tsdr_${serial}.png`),
        fullPage: true,
      });
      // Print interesting lines.
      const interesting = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .filter((l) =>
          /^(Mark|Standard|Status|Filing date|Filed|Registration|Date of registration|Owner|For |Goods and services|Class|U\.S\. classes|International class|Serial Number|First use|Filed in|Currently)/i.test(
            l,
          ),
        )
        .slice(0, 60);
      console.log(interesting.map((l) => `    ${l}`).join("\n"));
    } catch (err) {
      console.error(`  FAIL: ${(err as Error).message}`);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
