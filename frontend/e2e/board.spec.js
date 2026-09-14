import { expect, test } from "@playwright/test";

import { login } from "./helpers.js";

test("create an application, move status, timeline logs the change", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("link", { name: "Ansökningar", exact: true }).click();
  await page.getByRole("button", { name: "+ Ny ansökan" }).click();
  await page.getByLabel(/^Företag/).fill("Testföretaget AB");
  await page.getByLabel(/^Roll/).fill("QA-ingenjör");
  await page.getByLabel(/^Löneanspråk/).fill("45 000 kr/mån");
  await page.getByRole("button", { name: "Spara", exact: true }).click();

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

  await page.getByRole("link", { name: "Sparade jobb", exact: true }).click();
  await page.getByRole("button", { name: "+ Spara jobb" }).click();
  await page.getByLabel(/^Företag/).fill("Sparat AB");
  await page.getByLabel(/^Roll/).fill("Frontendutvecklare");
  await page.getByLabel("Status").selectOption("wishlist");
  await page.getByRole("button", { name: "Spara", exact: true }).click();

  const savedRow = page.locator(".lane-row", { hasText: "Frontendutvecklare" });
  await expect(savedRow).toBeVisible();

  await savedRow.getByRole("button", { name: "Ansök ↗" }).click();
  await expect(savedRow.getByText("Markerade du som sökt?")).toBeVisible();
  await savedRow.getByLabel(/^Löneanspråk/).fill("42 000 kr/mån");
  await savedRow.getByRole("button", { name: "Ja, sökt idag" }).click();

  await expect(
    page.locator(".lane-row", { hasText: "Frontendutvecklare" })
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Ansökningar", exact: true }).click();
  await expect(
    page.locator(".pipeline-row", { hasText: "Frontendutvecklare" })
  ).toBeVisible();
  await expect(
    page.locator(".lane[data-lane='late'] .pipeline-row", {
      hasText: "Frontendutvecklare",
    })
  ).toHaveCount(0);
});

test("select several applications and change status together", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("link", { name: "Ansökningar", exact: true }).click();
  for (const title of ["Bulk ett", "Bulk två"]) {
    await page.getByRole("button", { name: "+ Ny ansökan" }).click();
    await page.getByLabel(/^Företag/).fill("Bulk AB");
    await page.getByLabel(/^Roll/).fill(title);
    await page.getByLabel(/^Löneanspråk/).fill("45 000 kr/mån");
    await page.getByRole("button", { name: "Spara", exact: true }).click();
    await expect(page.locator(".pipeline-row", { hasText: title })).toBeVisible();
  }

  await page.getByRole("checkbox", { name: "Markera Bulk ett" }).check();
  await page.getByRole("checkbox", { name: "Markera Bulk två" }).check();
  await page.getByLabel("Ändra status för valda").selectOption("interview");
  await expect(page.getByRole("heading", { name: "Byt status" })).toBeVisible();
  await expect(page.getByText("2 jobb")).toBeVisible();
  await page.getByRole("button", { name: "Bekräfta" }).click();

  await expect(
    page.locator(".lane[data-lane='dialog'] .pipeline-row", {
      hasText: "Bulk ett",
    })
  ).toBeVisible();
  await expect(
    page.locator(".lane[data-lane='dialog'] .pipeline-row", {
      hasText: "Bulk två",
    })
  ).toBeVisible();
});

test("ansök keeps Jobbdjungeln in front and opens the employer page behind", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("link", { name: "Sparade jobb", exact: true }).click();
  await page.getByRole("button", { name: "+ Spara jobb" }).click();
  await page.getByLabel(/^Företag/).fill("Bakom AB");
  await page.getByLabel(/^Roll/).fill("Bakomutvecklare");
  await page.getByLabel("Status").selectOption("wishlist");
  await page.getByText("Redigera länkar").click();
  await page.getByLabel("Länk till ansökan").fill("https://example.com/ansok");
  await page.getByRole("button", { name: "Spara", exact: true }).click();

  const savedRow = page.locator(".lane-row", { hasText: "Bakomutvecklare" });
  await expect(savedRow).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await savedRow.getByRole("button", { name: "Ansök ↗" }).click();
  const popup = await popupPromise;
  await expect(savedRow.getByText("Markerade du som sökt?")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Sparade jobb" })).toBeVisible();
  await expect(popup).toHaveURL(/example\.com\/ansok/);
  await popup.close();
});

test("save and log updates the board without a page reload", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: "Ansökningar", exact: true }).click();
  await page.getByRole("button", { name: "+ Ny ansökan" }).click();
  await page.getByLabel(/^Företag/).fill("Direkt AB");
  await page.getByLabel(/^Roll/).fill("Originalroll");
  await page.getByLabel(/^Löneanspråk/).fill("40 000 kr/mån");
  await page.getByRole("button", { name: "Spara", exact: true }).click();

  const row = page.locator(".pipeline-row", { hasText: "Originalroll" });
  await expect(row).toBeVisible();

  await row.locator(".pipeline-row-main").click();
  await page.getByLabel(/^Roll/).fill("Uppdaterad roll");
  await page.getByRole("button", { name: "Spara", exact: true }).click();

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
  await page.getByLabel("Anteckning", { exact: true }).fill("Ringde rekryteraren");
  await page.getByRole("button", { name: "Logga", exact: true }).click();
  await expect(page.locator(".timeline")).toContainText("Ringde rekryteraren");
});
