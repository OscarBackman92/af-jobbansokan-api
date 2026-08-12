import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

const TABS = [
  { id: "dash", label: "Översikt" },
  { id: "saved", label: "Sparade jobb" },
  { id: "applied", label: "Ansökningar" },
  { id: "postings", label: "Annonser" },
  { id: "profile", label: "Profil & CV" },
];

const DESKTOP_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1115, height: 700 },
];

async function assertAllTabsVisible(page) {
  const nav = page.getByRole("navigation", { name: "Huvudnavigering" });
  for (const tab of TABS) {
    await expect(nav.getByRole("link", { name: tab.label, exact: true })).toBeVisible();
  }
}

async function assertActiveTabHitTest(page) {
  const result = await page.evaluate(() => {
    const active = document.querySelector(".tabs .tab.active");
    if (!(active instanceof HTMLElement)) return { ok: false, reason: "no-active" };
    const box = active.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!(hit instanceof Element) || !active.contains(hit)) {
      return {
        ok: false,
        reason: "hit-miss",
        hit: hit?.tagName || null,
        hitClass: hit instanceof Element ? String(hit.className).slice(0, 80) : null,
      };
    }
    return { ok: true };
  });
  expect(result, JSON.stringify(result)).toEqual({ ok: true });
}

for (const viewport of DESKTOP_VIEWPORTS) {
  test.describe(`header tabs @ ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("all five tabs visible on every deep link", async ({ page }) => {
      await login(page);

      for (const tab of TABS) {
        await page.goto(`/app/?tab=${tab.id}`);
        await expect(
          page.getByRole("link", { name: tab.label, exact: true })
        ).toHaveAttribute("aria-current", "page");
        await assertAllTabsVisible(page);
        await assertActiveTabHitTest(page);
      }
    });
  });
}

test.describe("brand navigation when signed in", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("logo returns to overview without full reload", async ({ page }) => {
    await login(page);
    await page.goto("/app/?tab=saved");
    await expect(
      page.getByRole("link", { name: "Sparade jobb", exact: true })
    ).toHaveAttribute("aria-current", "page");

    await page.evaluate(() => {
      window.__jdNoReload = true;
    });

    await page
      .getByRole("link", { name: "Jobbdjungeln – till översikten" })
      .click();

    await expect(page).toHaveURL(/\/app\/\?tab=dash/);
    await expect(page.getByRole("heading", { name: "Din översikt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Logga in", exact: true })).toHaveCount(
      0
    );
    expect(await page.evaluate(() => window.__jdNoReload)).toBe(true);
  });
});
