import { expect, test } from "@playwright/test";

/**
 * Admin smoke pack — login -> students -> notifications.
 *
 * Goal: catch the worst class of regressions (auth flow broken, page-level
 * routing broken, list view broken, notifications composer broken) on every
 * PR without standing up a full e2e harness. Keep this file lean.
 *
 * Test data assumes the default super-admin seeded by `pnpm --filter
 * backend run seed`. Override credentials via env vars in CI.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@saxony-egypt.edu";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe!2025";

test.describe("admin smoke", () => {
  test("logs in, lands on dashboard, and renders the brand chrome", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /smart campus admin/i }),
    ).toBeVisible();

    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // We may be redirected through /2fa (if the seeded admin has 2FA on)
    // — the smoke pack only asserts that we either reach the dashboard or
    // we land on the 2FA challenge. CI overrides the password to a
    // non-2FA account.
    await page.waitForURL(/\/(dashboard|2fa|$)/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(dashboard|2fa|$)/);

    // The persistent sidebar should always render once we're past auth.
    await expect(page.getByRole("navigation")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("navigates to the students list and shows the table", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/students");
    await expect(
      page.getByRole("heading", { name: /students/i }),
    ).toBeVisible();
    // Either the (empty-state) hint OR a populated table is acceptable —
    // we only assert that the page didn't crash and the list shell rendered.
    const hasEmptyState = await page
      .getByText(/no students/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasEmptyState) {
      await expect(page.locator("table, [role=table]").first()).toBeVisible();
    }
  });

  test("navigates to notifications and shows the composer", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { name: /notification|إشعار/i }),
    ).toBeVisible();
    // The composer always renders a submit button — verify it exists.
    await expect(
      page.getByRole("button", { name: /send|إرسال/i }).first(),
    ).toBeVisible();
  });
});

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|2fa|$)/, { timeout: 15_000 });
}
