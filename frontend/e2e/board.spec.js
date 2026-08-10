import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

test("create an application, move status, timeline logs the change", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("button", { name: "Ansökningar", exact: true }).click();
  await page.getByRole("button", { name: "+ Ny ansökan" }).click();
  await page.getByLabel(/^Företag/).fill("Testföretaget AB");
  await page.getByLabel(/^Roll/).fill("QA-ingenjör");
  await page.getByRole("button", { name: "Lägg till", exact: true }).click();

  const row = page.locator(".pipeline-row", { hasText: "QA-ingenjör" });
  await expect(row).toBeVisible();

  await row.locator("select").selectOption("interview");
  await expect(page.getByRole("heading", { name: "Byt status" })).toBeVisible();
  await page.getByRole("button", { name: "Bekräfta" }).click();
  await expect(
    page.locator(".lane[data-lane='dialog'] .pipeline-row", {
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

test("save job then mark applied moves it to Ansökningar", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Sparade jobb", exact: true }).click();
  await page.getByRole("button", { name: "+ Spara jobb" }).click();
  await page.getByLabel(/^Företag/).fill("Sparat AB");
  await page.getByLabel(/^Roll/).fill("Frontendutvecklare");
  await page.getByLabel("Status").selectOption("wishlist");
  await page.getByRole("button", { name: "Lägg till", exact: true }).click();

  const savedRow = page.locator(".lane-row", { hasText: "Frontendutvecklare" });
  await expect(savedRow).toBeVisible();

  await savedRow.getByRole("button", { name: "Ansök ↗" }).click();
  await expect(savedRow.getByText("Markerade du som sökt?")).toBeVisible();
  await savedRow.getByRole("button", { name: "Ja, sökt idag" }).click();

  await expect(
    page.locator(".lane-row", { hasText: "Frontendutvecklare" })
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Ansökningar", exact: true }).click();
  await expect(
    page.locator(".pipeline-row", { hasText: "Frontendutvecklare" })
  ).toBeVisible();
  await expect(
    page.locator(".lane[data-lane='late'] .pipeline-row", {
      hasText: "Frontendutvecklare",
    })
  ).toHaveCount(0);
});
