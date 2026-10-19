import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createInitialState, reduce } from "../src/lib/reducer";
import { answer, silentWav } from "./helpers";

// Hosted mode against e2e/mock-supabase.mjs (no RLS in the mock; see that file).

const MOCK = "http://localhost:54399";
const UID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type MockState = { tables: Record<string, Record<string, unknown>[]>; files: string[] };
const mockState = async (r: APIRequestContext): Promise<MockState> => (await r.get(`${MOCK}/__state`)).json();
const control = (r: APIRequestContext, c: Record<string, boolean>) => r.post(`${MOCK}/__control`, { data: c });

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

/** Real sign-in flow: request a link on /sign-in (stores the PKCE verifier), then open the callback. */
async function signIn(page: Page, next = "/today") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill("pilot@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();
  await page.goto(`/auth/callback?code=valid-code&next=${encodeURIComponent(next)}`);
}

async function onboardHosted(page: Page) {
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByText("Saved to your account")).toBeVisible();
  await page.getByLabel("Display name").fill("Pilot");
  await page.getByLabel("Your learning goal").fill("Pilot the hosted mode");
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

test("signed-out visitors are sent to sign-in, and the AI route refuses them", async ({ page, request }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Ftoday$/);
  await expect(page.getByRole("heading", { name: "Sign in to SpecLoop" })).toBeVisible();
  const res = await request.post("/api/ai/draft", { data: {} });
  expect(res.status()).toBe(401);
});

test("a bad or expired link returns to sign-in with an error", async ({ page }) => {
  await page.goto("/auth/callback?code=wrong&next=/today");
  await expect(page).toHaveURL(/\/sign-in\?error=/);
  await expect(page.locator(".notice-danger[role=alert]")).toContainText("invalid or expired");
});

test("magic-link sign-in, onboarding, answers, files persist to the account; sign-out ends the session", async ({ page, request }) => {
  await signIn(page);
  await onboardHosted(page);
  await expect(page.getByText("pilot@example.com")).toBeVisible();

  let s = await mockState(request);
  expect(s.tables.profiles).toEqual([expect.objectContaining({ user_id: UID, display_name: "Pilot" })]);

  await page.goto("/lessons/sl02");
  await answer(page, page.locator("section.question").nth(0), "50 percent", "I missed it");
  await page.getByRole("button", { name: "Mark lesson complete" }).click();
  await expect(page.getByText("Saving…")).toHaveCount(0);

  s = await mockState(request);
  expect(s.tables.attempts).toEqual([expect.objectContaining({ user_id: UID, question_id: "sl02-q1", result: "missed" })]);
  expect(s.tables.review_items).toEqual([expect.objectContaining({ user_id: UID, question_id: "sl02-q1", track: "missed", step: 0 })]);
  expect(s.tables.review_events).toHaveLength(1);
  expect(s.tables.lesson_completions).toEqual([expect.objectContaining({ user_id: UID, lesson_id: "sl02" })]);

  // Nothing went to browser storage in hosted mode.
  expect(await page.evaluate(() => localStorage.getItem("specloop:v1"))).toBeNull();

  // Audio goes to the private bucket under the user's folder.
  await page.goto("/audio?lesson=sl01");
  await expect(page.getByText(/Seed lessons are shared course content/)).toBeVisible();
  await page.locator("#audio-file").setInputFiles({ name: "sl01.wav", mimeType: "audio/wav", buffer: silentWav() });
  await expect(page.locator("audio")).toHaveCount(1);
  await expect(page.getByText("Saving…")).toHaveCount(0);
  s = await mockState(request);
  expect(s.files).toEqual([expect.stringMatching(new RegExp(`^audio/${UID}/`))]);
  expect(s.tables.audio_assets).toEqual([expect.objectContaining({ user_id: UID, lesson_id: "sl01", storage_path: s.files[0].replace(/^audio\//, "") })]);

  // A reload loads the same state back from the account, including the audio file.
  await page.goto("/lessons/sl02");
  await expect(page.locator("section.question").nth(0).getByRole("status")).toContainText("Recorded: missed");
  await page.goto("/lessons/sl01");
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await page.goto("/today");
  await expect(page.getByText("1/10")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("a failed save stops the app instead of falling back to local storage", async ({ page, request }) => {
  await signIn(page);
  await onboardHosted(page);
  await control(request, { failWrites: true });
  await page.goto("/lessons/sl03");
  const q = page.locator("section.question").nth(0);
  await q.getByRole("textbox").fill("40 feet");
  await q.getByRole("button", { name: /Submit/ }).click();
  await q.getByRole("button", { name: "I got it" }).click();
  await expect(page.getByRole("heading", { name: "Can't reach your SpecLoop account" })).toBeVisible();
  await expect(page.getByText(/couldn't be saved to the server/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("specloop:v1"))).toBeNull();
  expect((await mockState(request)).tables.attempts ?? []).toHaveLength(0);
});

test("an unreachable database or missing seed course shows an error, with no local fallback", async ({ page, request }) => {
  await signIn(page);
  await onboardHosted(page);

  await control(request, { failLoad: true });
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Can't reach your SpecLoop account" })).toBeVisible();
  await expect(page.getByText(/Nothing has been saved to this browser instead/)).toBeVisible();

  await control(request, { failLoad: false, seedMissing: true });
  await page.goto("/today");
  await expect(page.getByText(/seed course isn't installed/)).toBeVisible();
  await expect(page.getByText(/0003_seed_ccst_l1.sql/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("specloop:v1"))).toBeNull();
});

test("local demo data is imported only on request, adds rows, and stays in the browser", async ({ page, request }) => {
  // Put demo data in this origin's localStorage, as local mode would have.
  await page.goto("/about");
  await page.evaluate((state) => localStorage.setItem("specloop:v1", JSON.stringify(state)), LOCAL_STATE);

  await signIn(page);
  await onboardHosted(page);
  await expect(page.getByText("Demo data found in this browser")).toBeVisible();
  expect((await mockState(request)).tables.attempts ?? []).toHaveLength(0); // nothing imported yet

  await page.goto("/settings#data");
  await page.getByRole("button", { name: "Review this browser's demo data" }).click();
  await expect(page.getByText(/1 sources, 0 drafts, 0 approved lessons/)).toBeVisible();
  await expect(page.getByText(/2 answers, 1 lesson completions, 2 review/)).toBeVisible();
  const importBtn = page.getByRole("button", { name: "Import into my account" });
  await expect(importBtn).toBeDisabled();
  await page.getByLabel("Add this data to my account.").check();
  await importBtn.click();
  await expect(page.getByText("Import complete")).toBeVisible();

  const s = await mockState(request);
  expect(s.tables.attempts).toHaveLength(2);
  expect(s.tables.sources).toEqual([expect.objectContaining({ user_id: UID, title: "Local notes" })]);
  expect(s.tables.sources[0].id).not.toBe("src-local-1"); // remapped id
  expect(s.tables.review_items).toHaveLength(2);
  expect(s.tables.profiles).toEqual([expect.objectContaining({ display_name: "Pilot" })]); // account profile kept
  // Local copy untouched.
  const still = await page.evaluate(() => JSON.parse(localStorage.getItem("specloop:v1") || "null"));
  expect(still.sources[0].id).toBe("src-local-1");

  // Importing again warns about duplicates.
  await page.reload();
  await page.getByRole("button", { name: "Review this browser's demo data" }).click();
  await expect(page.getByText(/Importing again adds duplicate/)).toBeVisible();
});

/** A small, schema-valid local demo state, built with the app's own reducer. */
const LOCAL_STATE = (() => {
  let n = 0;
  const c = { nowIso: "2026-10-18T12:00:00.000Z", today: "2026-10-18", newId: () => `local-${++n}` };
  let s = createInitialState(c.nowIso);
  s = reduce(s, { type: "saveProfile", profile: { displayName: "Local", experienceLevel: "new", goal: "g", target: "ccst1", targetTopic: "CCST Level 1", dailyMinutes: 10, timezone: "UTC" } }, c);
  s = reduce(s, { type: "answerQuestion", lessonId: "sl01", questionId: "sl01-q1", kind: "recall", context: "lesson", response: "a", result: "correct" }, c);
  s = reduce(s, { type: "answerQuestion", lessonId: "sl01", questionId: "sl01-q2", kind: "recall", context: "lesson", response: "b", result: "missed" }, c);
  s = reduce(s, { type: "completeLesson", lessonId: "sl01" }, c);
  s = reduce(
    s,
    {
      type: "addSource",
      id: "src-local-1",
      source: { title: "Local notes", type: "own_notes", citation: "Me", notes: "", text: "t", rightsConfirmed: true, confidentialityConfirmed: true },
    },
    c,
  );
  return s;
})();
