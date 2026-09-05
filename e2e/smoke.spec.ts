import { test, expect } from "@playwright/test";

/**
 * The things that must be true before anyone can use the app at all: it
 * loads, it doesn't ask an anonymous visitor for anything but a sign-in, and
 * it renders on a phone without spilling off the side.
 *
 * These need no account, so they run everywhere.
 */

test("signed out, the app offers a way in and nothing else", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  // The course and semester used to be baked into this header.
  await expect(page.locator("body")).not.toContainText(/sem\s*1/i);
});

test("the page loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Failed media and missing favicons are noise; a thrown exception is not.
  const real = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/i.test(e));
  expect(real, real.join("\n")).toHaveLength(0);
});

test("nothing spills off the side of a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });
  expect(overflow.scroll, "the page is wider than the phone").toBeLessThanOrEqual(overflow.client + 1);
});

test("a protected page sends a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/admin/coursework");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("both sign-in fields are reachable by their labels", async ({ page }) => {
  await page.goto("/");
  // Not cosmetic: unlabelled inputs are unusable with a screen reader, and
  // they made the signed-in test unrunnable without anyone noticing.
  await expect(page.getByLabel(/username or email/i)).toBeVisible();
  await expect(page.getByLabel(/^password$/i)).toBeVisible();
});
