import { expect, test } from "@playwright/test";

// Build with NEXT_PUBLIC_SUPABASE_URL set but no anon key (see playwright.hosted.config.ts).
test.use({ baseURL: `http://localhost:${Number(process.env.E2E_HOSTED_PORT || 3101) + 1}` });

test("a half-configured deployment shows a config error and never uses browser storage", async ({ page, request }) => {
  for (const path of ["/", "/today", "/welcome", "/settings"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "SpecLoop isn't configured correctly" })).toBeVisible();
    await expect(page.getByText(/NEXT_PUBLIC_SUPABASE_ANON_KEY is missing/)).toBeVisible();
  }
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign-in is unavailable" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("specloop:v1"))).toBeNull();
  const ai = await request.post("/api/ai/draft", { data: {} });
  expect(ai.status()).toBe(503);
  const cfg = await (await request.get("/api/config")).json();
  expect(cfg.backend).toEqual({ mode: "misconfigured", problem: expect.stringContaining("ANON_KEY is missing") });
});
