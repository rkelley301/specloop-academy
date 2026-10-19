// Generates SpecLoop's app icons from one SVG design: a white loop arrow
// around a center dot on the app's teal (#0f6e68).
//
//   npm run icons        (needs Playwright's Chromium; set
//                         PLAYWRIGHT_CHROMIUM_PATH to use a system Chromium)
//
// Outputs:
//   src/app/icon.svg                  favicon (Next adds the <link>)
//   src/app/favicon.ico               32px fallback favicon
//   src/app/apple-icon.png            180px, full-bleed (iOS rounds it)
//   public/icons/icon-{192,512}.png   manifest "any": rounded tile, transparent corners
//   public/icons/maskable-{192,512}.png  manifest "maskable": full-bleed, glyph in the safe zone
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const root = join(import.meta.dirname, "..");
const TEAL = "#0f6e68";
const WHITE = "#ffffff";

/** Loop arrow + dot. `scale` is the glyph size relative to the 512 canvas. */
function glyph(scale) {
  const c = 256;
  const r = 132 * scale;
  const stroke = 46 * scale;
  const start = -38; // degrees (SVG y-down); the gap sits at the top right
  const end = 228; // the arc runs clockwise from start to end
  const pt = (deg, rad = r) => [c + rad * Math.cos((deg * Math.PI) / 180), c + rad * Math.sin((deg * Math.PI) / 180)];
  const [sx, sy] = pt(start);
  const [ex, ey] = pt(end);
  // Arrowhead: base centered on the arc's end, straddling the stroke; tip
  // further along the circle in the direction of travel (clockwise).
  const half = 50 * scale;
  const tip = pt(end + 30);
  const base1 = pt(end, r + half);
  const base2 = pt(end, r - half);
  const f = (n) => n.toFixed(2);
  return [
    `<path d="M ${f(sx)} ${f(sy)} A ${f(r)} ${f(r)} 0 1 1 ${f(ex)} ${f(ey)}" fill="none" stroke="${WHITE}" stroke-width="${f(stroke)}" stroke-linecap="butt"/>`,
    `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f(stroke / 2)}" fill="${WHITE}"/>`,
    `<polygon points="${f(tip[0])},${f(tip[1])} ${f(base1[0])},${f(base1[1])} ${f(base2[0])},${f(base2[1])}" fill="${WHITE}" stroke="${WHITE}" stroke-width="${f(8 * scale)}" stroke-linejoin="round"/>`,
    `<circle cx="${c}" cy="${c}" r="${f(34 * scale)}" fill="${WHITE}"/>`,
  ].join("");
}

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`;
// "any": rounded tile with transparent corners.
const roundedSvg = svg(`<rect width="512" height="512" rx="112" fill="${TEAL}"/>${glyph(1)}`);
// "maskable": full-bleed background; glyph inside the central 80% safe zone.
const maskableSvg = svg(`<rect width="512" height="512" fill="${TEAL}"/>${glyph(0.78)}`);
// Apple touch icon: full bleed, iOS applies its own mask; slightly larger glyph.
const appleSvg = svg(`<rect width="512" height="512" fill="${TEAL}"/>${glyph(0.92)}`);

function write(rel, data) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote ${rel} (${data.length} bytes)`);
}

/** Wraps one PNG in an .ico container (PNG-in-ICO, supported by all current browsers). */
function pngToIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  header.writeUInt8(size >= 256 ? 0 : size, 6);
  header.writeUInt8(size >= 256 ? 0 : size, 7);
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // offset
  return Buffer.concat([header, png]);
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
async function render(markup, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

write("src/app/icon.svg", Buffer.from(roundedSvg));
write("src/app/favicon.ico", pngToIco(await render(roundedSvg, 32), 32));
write("src/app/apple-icon.png", await render(appleSvg, 180));
for (const size of [192, 512]) {
  write(`public/icons/icon-${size}.png`, await render(roundedSvg, size));
  write(`public/icons/maskable-${size}.png`, await render(maskableSvg, size));
}
await browser.close();
