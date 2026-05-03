// Re-fetch TSDR with longer wait + scroll to expand collapsed sections
// (Goods and Services, Owner Info, Prosecution History) so we see the
// full record, not just the STATUS card.
import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const SERIALS = ["98063045", "99496564", "88976781"];

async function main() {
  const outDir = path.join(process.cwd(), "scripts", ".uspto-out");
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 1600 },
  });
  const page = await ctx.newPage();

  for (const serial of SERIALS) {
    console.log(`\n--- TSDR full ${serial} ---`);
    const url = `https://tsdr.uspto.gov/#caseNumber=${serial}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(8000);

      // Scroll to bottom to lazy-load any sections that need it.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      // Try clicking expandable section headers ("Goods and Services" etc).
      const sectionLabels = [
        "Mark Information",
        "Goods and Services",
        "Basis Information",
        "Current Owner",
        "Prosecution History",
      ];
      for (const label of sectionLabels) {
        const loc = page.getByText(label, { exact: false }).first();
        try {
          if (await loc.isVisible({ timeout: 1000 })) {
            await loc.click({ timeout: 2000 });
            await page.waitForTimeout(800);
          }
        } catch {
          /* not clickable / already expanded */
        }
      }

      const text = await page.evaluate(() => document.body.innerText);
      console.log(`  text length: ${text.length}`);
      await fs.writeFile(path.join(outDir, `tsdr_full_${serial}.txt`), text);
      await page.screenshot({
        path: path.join(outDir, `tsdr_full_${serial}.png`),
        fullPage: true,
      });
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
