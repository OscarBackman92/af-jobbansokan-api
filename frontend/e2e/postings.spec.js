import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

test("search Platsbanken (mocked) and save an ad to the board", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("button", { name: "RADAR Annonser" }).click();

  const card = page.locator(".job-card", {
    hasText: "Backendutvecklare Python",
  });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "+ Spara" }).click();
  await expect(
    card.getByRole("button", { name: "På tavlan ✓" })
  ).toBeVisible();

  await page.getByRole("button", { name: "OPS Tavlan" }).click();
  await expect(
    page.locator(".pipeline-row", { hasText: "Backendutvecklare Python" })
  ).toBeVisible();
});
