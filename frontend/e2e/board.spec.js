import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

test("create an application, move status, timeline logs the change", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("button", { name: "+ Ny ansökan" }).click();
  await page.getByLabel("Företag").fill("Testföretaget AB");
  await page.getByLabel("Roll").fill("QA-ingenjör");
  await page.getByRole("button", { name: "Lägg till", exact: true }).click();

  const row = page.locator(".pipeline-row", { hasText: "QA-ingenjör" });
  await expect(row).toBeVisible();

  await row.locator("select").selectOption("interview");
  await expect(
    page
      .locator(".pipeline-stage--interview .pipeline-row", {
        hasText: "QA-ingenjör",
      })
  ).toBeVisible();

  await page
    .locator(".pipeline-row", { hasText: "QA-ingenjör" })
    .locator(".pipeline-row-main")
    .click();
  await expect(page.getByRole("heading", { name: "Tidslinje" })).toBeVisible();
  await expect(page.locator(".timeline")).toContainText("Status:");
});
