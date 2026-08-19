import { expect, test } from "@playwright/test";

import { login, tabLink } from "./helpers.js";

const WIDTHS = [
  320, 360, 375, 393, 414, 480, 640, 741, 768, 820, 900, 1024, 1180, 1280,
  1440, 1920,
];

const TABS = [
  { id: "dash", label: "Översikt" },
  { id: "saved", label: "Sparade jobb" },
  { id: "applied", label: "Ansökningar" },
  { id: "postings", label: "Annonser" },
  { id: "profile", label: "Profil & CV" },
];

async function assertResponsiveLayout(page) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const brand = document.querySelector(".brand-link");
    const brandBox = brand?.getBoundingClientRect();
    const overflowing = Array.from(document.querySelectorAll("body *")).filter(
      (el) => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.classList.contains("sr-only")) return false;
        if (el.classList.contains("chart")) return false;
        if (el.classList.contains("tabs") || el.closest(".tabs")) return false;
        const style = window.getComputedStyle(el);
        if (style.textOverflow === "ellipsis") return false;
        const box = el.getBoundingClientRect();
        if (box.width < 4 || box.height < 4) return false;
        if (box.right > window.innerWidth + 2) return true;
        return false;
      }
    );

    return {
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      brandWidth: brandBox?.width ?? 0,
      brandScrollWidth: brand?.scrollWidth ?? 0,
      brandClientWidth: brand?.clientWidth ?? 0,
      spillCount: overflowing.length,
      spillSample: overflowing.slice(0, 5).map((el) => ({
        tag: el.tagName.toLowerCase(),
        className: String(el.className || "").slice(0, 80),
        right: Math.round(el.getBoundingClientRect().right),
      })),
    };
  });

  expect(
    metrics.scrollWidth,
    `document scrollWidth ${metrics.scrollWidth} > innerWidth ${metrics.innerWidth}`
  ).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.brandWidth, "brand width collapsed to 0").toBeGreaterThan(0);
  expect(metrics.brandScrollWidth).toBeLessThanOrEqual(
    metrics.brandClientWidth + 1
  );
  expect(
    metrics.spillCount,
    `unintended spill: ${JSON.stringify(metrics.spillSample)}`
  ).toBe(0);
}

test.describe("responsive widths", () => {
  for (const width of WIDTHS) {
    test(`no horizontal spill at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await login(page);

      for (const tab of TABS) {
        await page.goto(`/app/?tab=${tab.id}`);
        await expect(tabLink(page, tab.label)).toHaveAttribute(
          "aria-current",
          "page"
        );
        await assertResponsiveLayout(page);
      }
    });
  }
});
