import { expect, test } from "@playwright/test";

import { login, tabLink } from "./helpers.js";

test("create an application, move status, timeline logs the change", async ({
  page,
}) => {
  await login(page);

  await tabLink(page, "Ansökningar").click();
  await page.getByRole("button", { name: "+ Ny ansökan" }).click();
  await page.getByLabel(/^Företag/).fill("Testföretaget AB");
  await page.getByLabel(/^Roll/).fill("QA-ingenjör");
  await page.getByRole("dialog").getByRole("button", { name: "Spara", exact: true }).click();

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

  await tabLink(page, "Sparade jobb").click();
  await page.getByRole("button", { name: "+ Spara jobb" }).click();
  await page.getByRole("dialog").getByLabel(/^Företag/).fill("Sparat AB");
  await page.getByRole("dialog").getByLabel(/^Roll/).fill("Frontendutvecklare");
  await page.getByRole("dialog").locator("#app-field-status").selectOption("wishlist");
  await page.getByRole("dialog").getByRole("button", { name: "Spara", exact: true }).click();

  const savedRow = page.locator(".lane-row", { hasText: "Frontendutvecklare" });
  await expect(savedRow).toBeVisible();

  await savedRow.getByRole("button", { name: "Ansök ↗" }).click();
  await expect(savedRow.getByText("Markerade du som sökt?")).toBeVisible();
  await savedRow.getByRole("button", { name: "Ja, sökt idag" }).click();

  // Applied jobs stay mounted in the hidden Ansökningar panel as .lane-row.
  await expect(
    page.locator(".tab-panel:not(.tab-panel-hidden) .lane-row", {
      hasText: "Frontendutvecklare",
    })
  ).toHaveCount(0);
  await expect(tabLink(page, "Sparade jobb")).toContainText("0");

  await tabLink(page, "Ansökningar").click();
  await expect(
    page.locator(".pipeline-row", { hasText: "Frontendutvecklare" })
  ).toBeVisible();
  await expect(
    page.locator(".lane[data-lane='late'] .pipeline-row", {
      hasText: "Frontendutvecklare",
    })
  ).toHaveCount(0);
});

test("save and log updates the board without a page reload", async ({ page }) => {
  await login(page);

  await tabLink(page, "Ansökningar").click();
  await page.getByRole("button", { name: "+ Ny ansökan" }).click();
  await page.getByLabel(/^Företag/).fill("Direkt AB");
  await page.getByLabel(/^Roll/).fill("Originalroll");
  await page.getByRole("dialog").getByRole("button", { name: "Spara", exact: true }).click();

  const row = page.locator(".pipeline-row", { hasText: "Originalroll" });
  await expect(row).toBeVisible();

  await row.locator(".pipeline-row-main").click();
  await page.getByLabel(/^Roll/).fill("Uppdaterad roll");
  await page.getByRole("dialog").getByRole("button", { name: "Spara", exact: true }).click();

  await expect(
    page.locator(".pipeline-row", { hasText: "Uppdaterad roll" })
  ).toBeVisible();
  await expect(
    page.locator(".pipeline-row", { hasText: "Originalroll" })
  ).toHaveCount(0);

  await page
    .locator(".pipeline-row", { hasText: "Uppdaterad roll" })
    .locator(".pipeline-row-main")
    .click();
  await page.getByRole("textbox", { name: "Anteckning", exact: true }).fill("Ringde rekryteraren");
  await page.getByRole("dialog").getByRole("button", { name: "Logga", exact: true }).click();
  await expect(page.locator(".timeline")).toContainText("Ringde rekryteraren");
});
