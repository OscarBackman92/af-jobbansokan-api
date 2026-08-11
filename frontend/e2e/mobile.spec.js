import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

test.use({ viewport: { width: 393, height: 852 } });

const TABS = ["Översikt", "Sparade jobb", "Ansökningar", "Annonser", "Profil & CV"];

const DEEP_LINKS = [
  { tab: "dash", label: "Översikt" },
  { tab: "saved", label: "Sparade jobb" },
  { tab: "applied", label: "Ansökningar" },
  { tab: "postings", label: "Annonser" },
  { tab: "profile", label: "Profil & CV" },
];

async function assertActiveTabFullyVisible(page) {
  const clipped = await page.evaluate(() => {
    const tabs = document.querySelector(".tabs");
    const active = tabs?.querySelector(".tab.active");
    if (!tabs || !active) return true;
    const tabsBox = tabs.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    return (
      activeBox.right > tabsBox.right + 1 || activeBox.left < tabsBox.left - 1
    );
  });
  expect(clipped).toBe(false);
}

test("mobile layout: no overflow and tabs stay readable", async ({ page }) => {
  await login(page);

  for (const label of TABS) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("button", { name: label, exact: true })
    ).toHaveAttribute("aria-current", "page");

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const tabs = Array.from(document.querySelectorAll(".tabs .tab"));
      const pace = document.querySelector(".pace-table");
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        paceOverflow: pace ? pace.scrollWidth - pace.clientWidth : 0,
        tabBoxes: tabs.map((tab) => {
          const box = tab.getBoundingClientRect();
          return {
            label: tab.textContent?.trim() || "",
            width: box.width,
            scrollWidth: tab.scrollWidth,
          };
        }),
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.paceOverflow).toBeLessThanOrEqual(2);
    for (const tab of metrics.tabBoxes) {
      expect(tab.scrollWidth).toBeLessThanOrEqual(Math.ceil(tab.width) + 1);
    }
    await assertActiveTabFullyVisible(page);
  }
});

test("mobile deep link keeps active tab visible before and after badges", async ({
  page,
}) => {
  await login(page);

  for (const { tab, label } of DEEP_LINKS) {
    await page.goto(`/app/?tab=${tab}`);
    await expect(
      page.getByRole("button", { name: label, exact: true })
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
