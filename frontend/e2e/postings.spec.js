import { expect, test } from "@playwright/test";

import { login, tabLink } from "./helpers.js";

test("search Platsbanken (mocked) and save an ad to the board", async ({
  page,
}) => {
  await login(page);

  await tabLink(page, "Annonser").click();

  const card = page.locator(".job-card", {
    hasText: "Backendutvecklare Python",
  });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "+ Spara" }).click();
  await expect(
    card.getByRole("button", { name: "Sparad ✓" })
  ).toBeVisible();

  await tabLink(page, "Sparade jobb").click();
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
  await tabLink(page, "Annonser").click();
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
  const result = await page.evaluate(() => {
    const MARKER = "SLUT-PA-ANNONSTEXT";
    const dialog = document.querySelector('[role="dialog"]');
    const overlay = dialog?.closest(".overlay");
    const body = dialog?.querySelector(".job-modal-body");
    const candidates = [overlay, dialog, body].filter(
      (el) => el instanceof HTMLElement
    );
    const scroller = candidates.find(
      (el) => el.scrollHeight > el.clientHeight + 8
    );
    if (!(scroller instanceof HTMLElement)) {
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

    function markerBox() {
      const walker = document.createTreeWalker(
        dialog,
        NodeFilter.SHOW_TEXT
      );
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.data.indexOf(MARKER);
        if (idx < 0) continue;
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + MARKER.length);
        return range.getBoundingClientRect();
      }
      return null;
    }

    const before = scroller.scrollTop;
    const startBox = markerBox();
    scroller.scrollTop = scroller.scrollHeight;
    const after = scroller.scrollTop;
    const endBox = markerBox();
    const port = scroller.getBoundingClientRect();
    const markerVisible =
      !!endBox &&
      endBox.bottom <= port.bottom + 4 &&
      endBox.top >= port.top - 4;

    return {
      ok: after > before + 40,
      markerVisible,
      startedOffscreen: !!startBox && startBox.bottom > port.bottom + 4,
      className: String(scroller.className || "").slice(0, 80),
      before,
      after,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
    };
  });

  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
  expect(result.startedOffscreen, JSON.stringify(result)).toBe(true);
  expect(result.markerVisible, JSON.stringify(result)).toBe(true);
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
