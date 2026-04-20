// Rasterizes public/icon.svg into the PNGs referenced by the PWA
// manifest + iOS home-screen. One-shot: re-run whenever icon.svg
// changes.
//
// Usage: `npx tsx scripts/build-icons.ts`
// Sharp is available as a transitive dep via next 16; no explicit
// package install needed. If that changes, `npm install -D sharp`
// pulls it in directly.

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SOURCE = path.join(PUBLIC_DIR, "icon.svg");

type IconTarget = {
  name: string;
  size: number;
  // Maskable variants need 20% safe-zone padding so launchers can crop
  // to whatever mask shape the OS wants. The regular square variants
  // render edge-to-edge.
  maskable?: boolean;
};

const TARGETS: IconTarget[] = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-192.png", size: 192, maskable: true },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  // iOS home-screen icon. Apple always renders a glossy-ish square; the
  // 180px size is what iOS 15+ pulls for modern devices.
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  const svg = await fs.readFile(SOURCE);

  for (const target of TARGETS) {
    const outPath = path.join(PUBLIC_DIR, target.name);
    let pipeline = sharp(svg).resize(target.size, target.size, {
      fit: "contain",
    });

    if (target.maskable) {
      // Re-render the SVG inside an 80%-scale viewport surrounded by
      // the brand color so the safe zone is solid color, not
      // transparent — launchers will crop ~10% on each side.
      const inner = Math.round(target.size * 0.8);
      pipeline = sharp({
        create: {
          width: target.size,
          height: target.size,
          channels: 4,
          background: { r: 2, g: 132, b: 199, alpha: 1 }, // #0284C7
        },
      }).composite([
        {
          input: await sharp(svg)
            .resize(inner, inner, { fit: "contain" })
            .png()
            .toBuffer(),
          gravity: "center",
        },
      ]);
    }

    await pipeline.png({ compressionLevel: 9 }).toFile(outPath);
    console.log(
      `  wrote ${target.name} (${target.size}×${target.size}${
        target.maskable ? ", maskable" : ""
      })`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
