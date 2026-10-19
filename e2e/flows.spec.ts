import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { answer, onboard, silentWav } from "./helpers";

test.use({ timezoneId: "UTC" });

const DAY0 = new Date("2026-10-19T15:00:00Z");
const DAY1 = new Date("2026-10-20T15:00:00Z");

test("onboarding lands on a populated Today page", async ({ page }) => {
  await page.clock.install({ time: DAY0 });
  await onboard(page);
  await expect(page.getByRole("heading", { name: "Hi Sam" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The measurement loop: process to operator display" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start lesson" })).toBeVisible();
  await expect(page.getByText("0/10")).toBeVisible();
  await expect(page.getByText("Nothing scheduled this week")).toBeVisible();
  await expect(page.getByText("No activity yet")).toBeVisible();

  // Profile is editable later and persists across reloads.
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("Sam R");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Sam R");
});

test("seeded path renders 10 lessons in order with draft status", async ({ page }) => {
  await onboard(page);
  await page.goto("/path");
  const items = page.locator("ol.list > li");
  await expect(items).toHaveCount(10);
  await expect(items.first()).toContainText("The measurement loop");
  await expect(items.nth(9)).toContainText("Close the work order with useful records");
  await expect(page.getByText("Draft: technical review required").first()).toBeVisible();
  await expect(page.getByText(/Seed course status/)).toBeVisible();
});

test("lesson: transcript fallback, quiz gating, scenario, completion, then review queue next day", async ({ page }) => {
  await page.clock.install({ time: DAY0 });
  await onboard(page);
  await page.goto("/lessons/sl02");
  await expect(page.getByRole("heading", { name: "What a 4–20 mA signal tells you" })).toBeVisible();
  await expect(page.getByText("No narration attached yet")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.locator(".pause-cue").first()).toContainText("Pause 3s");

  const q1 = page.locator("section.question").nth(0);
  // Can't reveal without answering.
  await q1.getByRole("button", { name: /Submit/ }).click();
  await expect(q1.getByRole("alert")).toContainText("Write your answer first");
  await expect(q1.getByText("50% of span")).toHaveCount(0);
  await answer(page, q1, "50 percent", "I got it");
  await expect(q1.getByRole("status")).toContainText("Review in 3 days");

  const q2 = page.locator("section.question").nth(1);
  await answer(page, q2, "not sure", "I missed it");
  await expect(q2.getByRole("status")).toContainText("tomorrow");

  const scenario = page.locator("section.question").nth(3);
  await expect(scenario).toContainText("Field scenario");
  await answer(page, scenario, "Eight mA is a quarter of span so 50 degrees", "I got it");
  await expect(scenario).toContainText("50 degrees. Eight milliamps is 25% of span");

  await page.getByRole("button", { name: "Mark lesson complete" }).click();
  await expect(page.getByText("Completed").first()).toBeVisible();

  await page.goto("/today");
  await expect(page.getByText("1/10")).toBeVisible();
  await expect(page.getByText(/Completed “What a 4–20 mA signal tells you”/)).toBeVisible();
  await expect(page.locator("#up-h").locator("..")).toContainText("2 items");

  // Next day: the missed item is due.
  await page.clock.setSystemTime(DAY1);
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "1 review item" })).toBeVisible();
  await page.getByRole("link", { name: "Start review" }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByText("Why is this due?").click();
  await expect(page.getByText(/Missed ladder, review 1 of 3/)).toBeVisible();
  const card = page.locator("section.question");
  await expect(page.getByRole("button", { name: "Finish" })).toBeDisabled();
  await answer(page, card, "4 mA is the bottom of range", "I got it");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { name: "Review complete" })).toBeVisible();
  await page.getByRole("button", { name: "See schedule" }).click();
  await expect(page.getByText("No reviews due")).toBeVisible();
  // Missed → correct on review → next check in 3 days (Oct 23).
  await expect(page.locator("#sched-h").locator("..")).toContainText("Fri, Oct 23");
});

test("library: add source, draft, edit, approve, and see attribution", async ({ page }) => {
  await onboard(page);
  await page.goto("/library");
  await expect(page.getByText("No sources yet")).toBeVisible();
  await page.getByRole("link", { name: "Add a source" }).click();

  await page.getByLabel("Title").fill("My DP level notes");
  await page.getByLabel("Citation").fill("S. Tech, personal field notes, Oct 2026");
  await page.getByLabel("Source text or excerpts").fill("My own notes on DP level measurement and wet legs.");
  await page.getByRole("button", { name: "Save source" }).click();
  await expect(page.getByText("Confirm you have the right to use this material.")).toBeVisible();
  await page.getByLabel(/I have the right to use this material/).check();
  await page.getByLabel(/no confidential material/).check();
  await page.getByRole("button", { name: "Save source" }).click();

  await expect(page.getByRole("heading", { name: "My DP level notes" })).toBeVisible();
  await expect(page.getByText("AI drafting isn't configured")).toBeVisible();
  await page.getByRole("button", { name: "Start from template" }).click();
  await expect(page).toHaveURL(/\/drafts\//);
  await expect(page.getByText("S. Tech, personal field notes, Oct 2026")).toBeVisible();
  await expect(page.getByText("Replace every [EDIT] placeholder.")).toBeVisible();

  await page.getByLabel("Title", { exact: true }).fill("DP level basics");
  await page.getByLabel("Objective").fill("Explain how a DP transmitter infers level.");
  await page.getByLabel("Narration script").fill("DP level uses the weight of the liquid column. [PAUSE 3 SECONDS] Field tasks follow site procedures.");
  await page.getByLabel("Prompt", { exact: true }).fill("What does a DP level transmitter measure?");
  await page.getByLabel("Answer key", { exact: true }).fill("The hydrostatic head difference between its high and low connections.");
  await page.getByLabel("Scenario prompt").fill("Level reads high after maintenance. What do you check?");
  await page.getByLabel(/Answer key \(key points/).fill("Impulse lines, manifold valve positions, configuration.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Not ready for approval")).toHaveCount(0);

  const approve = page.getByRole("button", { name: "Approve & publish lesson" });
  await expect(approve).toBeDisabled();
  await page.getByLabel("Reviewer name").fill("Lead Tech");
  await page.getByLabel(/checked the technical statements/).check();
  await page.getByLabel(/original wording/).check();
  await page.getByLabel(/doesn't authorize live work/).check();
  await approve.click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Open the lesson" }).click();
  await expect(page.getByRole("heading", { name: "DP level basics" })).toBeVisible();
  await expect(page.locator("#src-h").locator("..")).toContainText("S. Tech, personal field notes, Oct 2026");

  await page.goto("/path");
  await expect(page.getByRole("heading", { name: "My approved lessons" })).toBeVisible();
});

test("audio: upload, play controls, replace-safe metadata, remove falls back to transcript", async ({ page }) => {
  await onboard(page);
  await page.goto("/audio?lesson=sl01");
  await expect(page.getByText("OneStudio direct generation")).toBeVisible();
  await expect(page.getByText("Not configured")).toBeVisible();

  await page.locator("#audio-file").setInputFiles({ name: "bad.ogg", mimeType: "audio/ogg", buffer: Buffer.from("x") });
  await expect(page.locator(".error-text[role=alert]")).toContainText("Choose an MP3 or WAV file.");

  await page.locator("#audio-file").setInputFiles({ name: "sl01.wav", mimeType: "audio/wav", buffer: silentWav() });
  await expect(page.locator("audio")).toHaveCount(1);
  await expect(page.getByText(/recorded from script v1/)).toBeVisible();

  await page.goto("/lessons/sl01");
  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.readyState)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "1.5×" }).click();
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.playbackRate)).toBe(1.5);
  // SL01 has no scenario answer in the pack: the UI says so instead of inventing one.
  const scenario = page.locator("section.question").nth(3);
  await scenario.getByRole("textbox").fill("Compare local and control-room values");
  await scenario.getByRole("button", { name: /Submit/ }).click();
  await expect(scenario.getByText("Answer key missing")).toBeVisible();

  await page.goto("/audio?lesson=sl01");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove audio" }).click();
  await page.goto("/lessons/sl01");
  await expect(page.getByText("No narration attached yet")).toBeVisible();
});

test("settings: export and delete data", async ({ page }) => {
  await onboard(page);
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export data (JSON)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^specloop-export-.*\.json$/);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByLabel("Display name")).toHaveValue("");
});

test("corrupt saved data shows a designed error state with recovery", async ({ page }) => {
  await page.goto("/about");
  await page.evaluate(() => localStorage.setItem("specloop:v1", "{not json"));
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "We couldn't read your saved data" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset to fresh demo" }).click();
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
});

test("layout fits the viewport, keyboard skip link works, and pages pass axe checks", async ({ page }) => {
  await onboard(page);
  for (const path of ["/today", "/path", "/lessons/sl03", "/review", "/library", "/library/new", "/audio", "/settings", "/about"]) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map((v) => `${path}: ${v.id} (${v.nodes.length})`)).toEqual([]);
  }
  await page.goto("/today");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("AI refusal is shown to the user and not retried", async ({ page }) => {
  let draftCalls = 0;
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        auth: "local-demo",
        storage: "local",
        ai: { enabled: true, provider: "anthropic", model: "claude-opus-5-5" },
        tts: { onestudioConfigured: false },
        supabase: { configured: false, wired: false },
        billing: { enabled: false, plan: "local-demo", message: "Payments aren't enabled in this build." },
      },
    }),
  );
  await page.route("**/api/ai/draft", (r) => {
    draftCalls += 1;
    return r.fulfill({
      status: 422,
      json: {
        error: "The AI model declined to draft from this source.",
        refusal: { category: "general_harms", explanation: "This request was declined.", model: "claude-opus-5-5" },
      },
    });
  });
  await onboard(page);
  await page.goto("/library/new");
  await page.getByLabel("Title").fill("Notes");
  await page.getByLabel("Citation").fill("Me, 2026");
  await page.getByLabel("Source text or excerpts").fill("A paragraph of my own notes on loop checks, long enough to send for drafting.");
  await page.getByLabel(/I have the right to use this material/).check();
  await page.getByLabel(/no confidential material/).check();
  await page.getByRole("button", { name: "Save source" }).click();

  await page.getByRole("button", { name: "Draft with AI…" }).click();
  await page.getByLabel(/processed by an external provider/).check();
  await page.getByRole("button", { name: "Send and generate draft" }).click();
  await expect(page.getByText("The AI model declined this request")).toBeVisible();
  await expect(page.getByText("This request was declined.")).toBeVisible();
  await expect(page.getByText("general_harms")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send and generate draft" })).toBeDisabled();
  expect(draftCalls).toBe(1);
  await expect(page).not.toHaveURL(/\/drafts\//);
  await page.goto("/library");
  await expect(page.getByText("No drafts yet")).toBeVisible();
});
