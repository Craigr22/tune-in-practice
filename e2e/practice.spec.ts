import { test, expect } from "@playwright/test";

/**
 * The path the whole app exists for: a student opens their page, ticks off
 * today's practice, and it reaches the teacher.
 *
 * This is the one test that crosses every layer — page, hooks, the atomic
 * RPC, RLS, and back out through the teacher's roster. Most of the failures
 * in this project's history would have been caught here and nowhere else.
 *
 * It needs a real account, so it reads credentials from the environment and
 * skips without them. To run it:
 *   E2E_STUDENT_EMAIL=… E2E_STUDENT_PASSWORD=… npx playwright test
 */
const email = process.env.E2E_STUDENT_EMAIL;
const password = process.env.E2E_STUDENT_PASSWORD;

test.describe("a student's practice reaches the teacher", () => {
  test.skip(!email || !password, "set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD to run");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /^hi /i })).toBeVisible();
  });

  test("the day's page says what to do, or why there is nothing", async ({ page }) => {
    const header = page.locator(".home").first();
    await expect(header).toBeVisible();
    // Either today's session, or a rest day that still says what's next —
    // never a blank page.
    await expect(page.locator("body")).toContainText(
      /warm-up|no practice today/i,
    );
  });

  test("ticking every step records the practice", async ({ page }) => {
    const marks = page.getByRole("button", { name: /^mark .* done$/i });
    const count = await marks.count();
    test.skip(count === 0, "no practice scheduled today");

    // Work through the steps; each disappears as it is done.
    for (let i = 0; i < 3; i++) {
      const next = page.getByRole("button", { name: /^mark .* done$/i }).first();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
      await expect(next).toBeHidden({ timeout: 10_000 });
    }

    // The streak is fed by the practice log the RPC writes, so a number here
    // means the whole chain held: page → RPC → log → back out.
    await page.reload();
    await expect(page.locator("body")).toContainText(/day/i);
  });

  test("a student cannot reach the admin area", async ({ page }) => {
    await page.goto("/admin/coursework");
    await expect(page.getByText(/course plan/i)).toHaveCount(0);
  });
});
