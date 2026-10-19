import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { answer, onboard } from "./helpers";

// Installability and offline behavior of the production build (local demo mode).

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer) {
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Real offline: context.setOffline() blocks the page's own requests, but in
 * Chromium it does NOT block network requests made by the service worker,
 * so those are aborted explicitly too.
 */
async function goOffline(context: BrowserContext) {
  await context.setOffline(true);
  await context.route("**/*", (route) =>
    route.request().serviceWorker() ? route.abort("internetdisconnected") : route.fallback(),
  );
}
async function goOnline(context: BrowserContext) {
  await context.unroute("**/*");
  await context.setOffline(false);
}

async function swReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load isn't controlled until the worker claims it; wait for that.
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15_000 }).toBe(true);
}

test("manifest and icons meet Android's install requirements", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.headers()["content-type"]).toContain("application/manifest+json");
  const m = await res.json();
  expect(m).toMatchObject({
    name: "SpecLoop Academy",
    short_name: "SpecLoop",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#0f6e68",
    background_color: "#f4f6f8",
  });
  for (const icon of m.icons as { src: string; sizes: string; purpose: string }[]) {
    const img = await request.get(icon.src);
    expect(img.ok(), icon.src).toBe(true);
    const { width, height } = pngSize(await img.body());
    expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
  }
  const purposes = (m.icons as { sizes: string; purpose: string }[]).map((i) => `${i.sizes}:${i.purpose}`);
  expect(purposes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "192x192:maskable", "512x512:maskable"]));
  const apple = await request.get("/apple-icon.png");
  expect(pngSize(await apple.body())).toEqual({ width: 180, height: 180 });

});

test("Chrome reports no installability errors", async ({ baseURL }, info) => {
  // Chrome never offers installation in incognito-like contexts (Playwright's
  // default), so this check runs in a real, persistent profile.
  const profile = mkdtempSync(join(tmpdir(), "specloop-pwa-"));
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    baseURL,
    ...(info.project.name === "phone" ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {}),
  });
  try {
    const page = await ctx.newPage();
    await page.goto("/about");
    await swReady(page);
    // Chrome's own verdict: the same check behind the Android install prompt.
    const cdp = await ctx.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    expect(installabilityErrors).toEqual([]);
    const appManifest = await cdp.send("Page.getAppManifest");
    expect(appManifest.errors).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

test("service worker never caches the API, and sw.js itself is never cached by HTTP", async ({ page, request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  await page.goto("/about");
  await swReady(page);
  await page.request.get("/api/config");
  await page.evaluate(() => fetch("/api/config").then((r) => r.json()));
  const cached = await page.evaluate(async () => {
    const out: string[] = [];
    for (const key of await caches.keys()) for (const r of await (await caches.open(key)).keys()) out.push(new URL(r.url).pathname);
    return out;
  });
  expect(cached).toEqual(expect.arrayContaining(["/offline.html", "/today", "/lessons/sl01", "/lessons/sl10"]));
  expect(cached.some((p) => p.startsWith("/api/") || p.startsWith("/auth/"))).toBe(false);
});

test("installed app keeps working offline with local data", async ({ page, context }) => {
  await onboard(page);
  await swReady(page);
  await page.goto("/lessons/sl02");
  await answer(page, page.locator("section.question").nth(0), "50 percent", "I got it");
  await page.getByRole("button", { name: "Mark lesson complete" }).click();

  await goOffline(context);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "What a 4–20 mA signal tells you" })).toBeVisible();
    await expect(page.locator("section.question").nth(0).getByRole("status")).toContainText("Recorded: got it");

    // Today and a lesson never opened before both come from the install-time cache.
    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "Hi Sam" })).toBeVisible();
    await expect(page.getByText("1/10")).toBeVisible();
    await page.goto("/lessons/sl07");
    await expect(page.getByRole("heading", { name: "Troubleshoot from symptom to cause" })).toBeVisible();

    // Answers made offline are saved locally.
    await answer(page, page.locator("section.question").nth(0), "symptom vs conclusion", "I missed it");

    // A page that was never cached gets the offline page, not a browser error.
    await page.goto("/library/new");
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  } finally {
    await goOnline(context);
  }
  await page.goto("/today");
  await expect(page.getByText(/Answered a recall question \(missed\) in “Troubleshoot from symptom to cause”/)).toBeVisible();
});
