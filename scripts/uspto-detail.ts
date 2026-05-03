// Click into a single TM-Search result and capture the full detail
// page. Used to pull complete goods/services + filing/registration
// dates for the BACKFLO marks owned by Park Environmental Equipment.
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

  // Navigate to TM-Search and run the query that surfaces both marks.
  await page.goto("https://tmsearch.uspto.gov/search/search-information", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#searchbar").waitFor({ state: "visible" });
  await page.locator("#searchbar").click();
  await page.locator("#searchbar").fill("backflo");
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(5000);

  for (const serial of SERIALS) {
    console.log(`\n--- detail for ${serial} ---`);
    // The serial appears in a table header / link. Try the visible text
    // approach first since the exact selector varies.
    try {
      const link = page.getByText(serial, { exact: true }).first();
      await link.waitFor({ state: "visible", timeout: 10_000 });
      await link.click();
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(4000);
      const text = await page.evaluate(() => document.body.innerText);
      const url = page.url();
      console.log(`  url: ${url}`);
      console.log(`  text length: ${text.length}`);
      await fs.writeFile(path.join(outDir, `detail_${serial}.txt`), text);
      await fs.writeFile(path.join(outDir, `detail_${serial}.url`), url);
      await page.screenshot({
        path: path.join(outDir, `detail_${serial}.png`),
        fullPage: true,
      });
      // Print key fields if visible.
      const interesting = text
        .split("\n")
        .filter((l) =>
          /(Filing date|Registration date|Goods|Services|Status|Owner|Class|Mark|First use|Date|Serial)/i.test(
            l,
          ),
        )
        .slice(0, 40);
      console.log(interesting.map((l) => `  ${l.trim()}`).join("\n"));
      // Go back for next serial.
      await page.goBack();
      await page.waitForTimeout(2000);
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
