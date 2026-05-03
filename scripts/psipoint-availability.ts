// Common-law clearance probe for "Psipoint": hit Google, LinkedIn,
// Crunchbase, Product Hunt + the two domains that matter.
// Output is text + screenshots in scripts/.uspto-out/ (renamed).
//
// Run: `npx tsx scripts/psipoint-availability.ts`

import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const TARGETS = [
  {
    name: "psipoint_org",
    url: "https://psipoint.org",
  },
  {
    name: "psipoint_com_full",
    url: "https://psipoint.com",
  },
  {
    name: "bing_quoted",
    url: 'https://www.bing.com/search?q=%22Psipoint%22+-sims',
  },
  {
    name: "bing_company",
    url: "https://www.bing.com/search?q=Psipoint+company+SaaS",
  },
];

async function main() {
  const outDir = path.join(process.cwd(), "scripts", ".uspto-out");
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 1100 },
  });
  const page = await ctx.newPage();

  for (const t of TARGETS) {
    console.log(`\n--- ${t.name} ---`);
    try {
      const res = await page.goto(t.url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      console.log(`  status: ${res?.status()}  url: ${page.url()}`);
      await page.waitForTimeout(4000);
      const text = await page.evaluate(() => document.body.innerText);
      const title = await page.title();
      console.log(`  title: ${title.slice(0, 100)}`);
      console.log(`  text len: ${text.length}`);
      const snippet = text
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .slice(0, 30)
        .join("\n  | ");
      console.log(`  first lines:\n  | ${snippet}`);
      await fs.writeFile(path.join(outDir, `pp_${t.name}.txt`), text);
      await page.screenshot({
        path: path.join(outDir, `pp_${t.name}.png`),
        fullPage: false,
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
