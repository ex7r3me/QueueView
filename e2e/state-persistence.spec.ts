import { expect, test } from "@playwright/test";

test.describe("QueueView live-backend persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("persists overview context across full reload", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Pattern" }).click();
    await page.getByRole("button", { name: "Failures" }).click();
    await page.getByLabel("Queue search").fill("notifications");

    await page.reload();

    await expect(page.getByRole("button", { name: "Pattern" })).toHaveClass(/active/);
    await expect(page.getByRole("button", { name: "Failures" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Queue search")).toHaveValue("notifications");
  });

  test("preserves queue deep-link and active job tab after reload", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Opinionated" }).click();
    await page.getByRole("button", { name: "Queues" }).click();
    await page.getByLabel("Queue search").fill("notifications");
    await page.getByRole("button", { name: "Open queue notifications" }).first().click();

    const retryTab = page.getByRole("tab", { name: /^Retry \(/ });
    await retryTab.click();
    await expect(retryTab).toHaveAttribute("aria-selected", "true");
    await page.waitForFunction(() => {
      const raw = window.localStorage.getItem("queueview.ui-state.v1");
      if (!raw) {
        return false;
      }

      const parsed = JSON.parse(raw) as { activeTab?: string };
      return parsed.activeTab === "retryScheduled";
    });

    await page.reload();

    await expect(page).toHaveURL(/#\/queues\/notifications$/);
    await expect(page.getByRole("tab", { name: /^Retry \(/ })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Back to all queues" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("button", { name: "Opinionated" })).toHaveClass(/active/);
    await expect(page.getByRole("button", { name: "Queues" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Queue search")).toHaveValue("notifications");
  });
});
