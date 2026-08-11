import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

test.use({ viewport: { width: 393, height: 852 } });

const TABS = ["Översikt", "Sparade jobb", "Ansökningar", "Annonser", "Profil & CV"];

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
        paceOverflow: pace
          ? pace.scrollWidth - pace.clientWidth
          : 0,
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
  }
});
