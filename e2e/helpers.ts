import { expect, type Page } from "@playwright/test";

export async function onboard(page: Page, name = "Sam") {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Your learning goal").fill("Get solid on loop fundamentals before the CCST exam");
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

/** A 1-second silent 8 kHz mono WAV. */
export function silentWav(): Buffer {
  const rate = 8000;
  const samples = rate;
  const b = Buffer.alloc(44 + samples);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples, 40);
  b.fill(128, 44);
  return b;
}

export async function answer(page: Page, card: ReturnType<Page["locator"]>, text: string, grade: "I got it" | "I missed it") {
  await card.getByRole("textbox").fill(text);
  await card.getByRole("button", { name: /Submit/ }).click();
  await expect(card.getByText(/Answer key/).first()).toBeVisible();
  await card.getByRole("button", { name: grade }).click();
  await expect(card.getByRole("status")).toContainText("Recorded");
}
