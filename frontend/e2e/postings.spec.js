import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

test("search Platsbanken (mocked) and save an ad to the board", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("link", { name: "Annonser", exact: true }).click();

  const card = page.locator(".job-card", {
    hasText: "Backendutvecklare Python",
  });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "+ Spara" }).click();
  await expect(
    card.getByRole("button", { name: "Sparad ✓" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Sparade jobb", exact: true }).click();
  await expect(
    page.locator(".lane-row", { hasText: "Backendutvecklare Python" })
  ).toBeVisible();
});

const AD_SCROLL_VIEWPORTS = [
  { name: "phone", width: 393, height: 720 },
  { name: "desktop", width: 1280, height: 720 },
];

async function openPythonAd(page) {
  await login(page);
  await page.getByRole("link", { name: "Annonser", exact: true }).click();
  const card = page.locator(".job-card", {
    hasText: "Backendutvecklare Python",
  });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Backendutvecklare Python" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("SLUT-PA-ANNONSTEXT")).toBeAttached();
  return dialog;
}

async function assertAdDialogScrolls(page) {
  const end = page.getByText("SLUT-PA-ANNONSTEXT");
  await expect(end).not.toBeInViewport();

  const result = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const overlay = dialog?.closest(".overlay");
    const body = dialog?.querySelector(".job-modal-body");
    const candidates = [overlay, dialog, body].filter(
      (el) => el instanceof HTMLElement
    );
    const scroller = candidates.find(
      (el) => el.scrollHeight > el.clientHeight + 8
    );
    if (!scroller) {
      return {
        ok: false,
        reason: "no-scroller",
        sizes: candidates.map((el) => ({
          className: String(el.className || "").slice(0, 80),
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        })),
      };
    }
    const before = scroller.scrollTop;
    scroller.scrollTop = Math.min(
      480,
      scroller.scrollHeight - scroller.clientHeight
    );
    return {
      ok: scroller.scrollTop > before + 40,
      className: String(scroller.className || "").slice(0, 80),
      before,
      after: scroller.scrollTop,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
    };
  });

  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });

  await end.scrollIntoViewIfNeeded();
  await expect(end).toBeInViewport();
}

for (const viewport of AD_SCROLL_VIEWPORTS) {
  test(`job ad modal scrolls on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await openPythonAd(page);
    await assertAdDialogScrolls(page);
  });
}
