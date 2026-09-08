import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

test.use({ viewport: { width: 393, height: 852 } });

const TABS = [
  "Översikt",
  "Sparade jobb",
  "Ansökningar",
  "Annonser",
  "Profil & CV",
];

const DEEP_LINKS = [
  { tab: "dash", label: "Översikt" },
  { tab: "saved", label: "Sparade jobb" },
  { tab: "applied", label: "Ansökningar" },
  { tab: "postings", label: "Annonser" },
  { tab: "profile", label: "Profil & CV" },
];

async function assertActiveTabFullyVisible(page) {
  const result = await page.evaluate(() => {
    const tabs = document.querySelector(".tabs");
    const active = tabs?.querySelector(".tab.active");
    if (!(tabs instanceof HTMLElement) || !(active instanceof HTMLElement)) {
      return { clipped: true, hitMiss: true };
    }
    const tabsBox = tabs.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    const clipped =
      activeBox.right > tabsBox.right + 1 || activeBox.left < tabsBox.left - 1;
    const x = activeBox.left + activeBox.width / 2;
    const y = activeBox.top + activeBox.height / 2;
    const hit = document.elementFromPoint(x, y);
    const hitMiss = !(hit instanceof Element) || !active.contains(hit);
    return { clipped, hitMiss };
  });
  expect(result.clipped).toBe(false);
  expect(result.hitMiss).toBe(false);
}

async function assertNoRealMainOverflow(page) {
  const overflowing = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return -1;
    return Array.from(main.querySelectorAll("*")).filter((el) => {
      if (el.classList?.contains("sr-only")) return false;
      const box = el.getBoundingClientRect();
      if (box.width < 4 || box.height < 4) return false;
      return el.scrollWidth - el.clientWidth > 2;
    }).length;
  });
  expect(overflowing).toBe(0);
}

test("mobile layout: no overflow and tabs stay readable", async ({ page }) => {
  await login(page);

  for (const label of TABS) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(
      page.getByRole("link", { name: label, exact: true })
    ).toHaveAttribute("aria-current", "page");

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const nav = document.querySelector(".tabs");
      const tabs = Array.from(document.querySelectorAll(".tabs .tab"));
      const pace = document.querySelector(".pace-table");
      const navBox = nav?.getBoundingClientRect();
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        paceOverflow: pace ? pace.scrollWidth - pace.clientWidth : 0,
        tabCount: tabs.filter((tab) => !tab.classList.contains("tab--desktop-only"))
          .length,
        clippedTabs: tabs
          .filter((tab) => {
            if (!(navBox instanceof DOMRect) || !(tab instanceof HTMLElement)) {
              return true;
            }
            if (tab.classList.contains("tab--desktop-only")) return false;
            const box = tab.getBoundingClientRect();
            return (
              box.left < navBox.left - 1 ||
              box.right > navBox.right + 1 ||
              box.top < navBox.top - 1 ||
              box.bottom > navBox.bottom + 1
            );
          })
          .map((tab) => tab.getAttribute("aria-label") || tab.textContent?.trim()),
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.paceOverflow).toBeLessThanOrEqual(2);
    expect(metrics.tabCount).toBe(5);
    expect(metrics.clippedTabs, JSON.stringify(metrics.clippedTabs)).toEqual([]);
    await assertActiveTabFullyVisible(page);
    await assertNoRealMainOverflow(page);
  }
});

test("mobile deep link keeps active tab visible before and after badges", async ({
  page,
}) => {
  await login(page);

  for (const { tab, label } of DEEP_LINKS) {
    await page.goto(`/app/?tab=${tab}`);
    await expect(
      page.getByRole("link", { name: label, exact: true })
    ).toHaveAttribute("aria-current", "page");

    // Mount state — before nav badges may have grown the strip.
    await assertActiveTabFullyVisible(page);

    await page
      .waitForFunction(
        () => document.querySelectorAll(".tabs .tab-count").length >= 1,
        null,
        { timeout: 15_000 }
      )
      .catch(() => {});

    // After badges render and scrollWidth grows.
    await assertActiveTabFullyVisible(page);
  }
});

test("annonser KPI uses tracked wording, not sparade", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Annonser", exact: true }).click();

  const summary = page.getByLabel("Söksammanfattning");
  await expect(summary).toBeVisible();
  await expect(summary.getByText("Spårade", { exact: true })).toBeVisible();
  await expect(summary.getByText("redan i listan", { exact: true })).toBeVisible();
  await expect(summary.locator(".metric-label", { hasText: /^Sparade$/ })).toHaveCount(0);
  await expect(summary.locator(".metric-detail", { hasText: /^sparade$/ })).toHaveCount(0);
});
