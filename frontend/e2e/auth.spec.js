import { expect, test } from "@playwright/test";

import { latestVerifyKey } from "./helpers.js";

test("register, verify e-mail from the mail file, and log in", async ({
  page,
}) => {
  const email = `reg-${Date.now()}@example.com`;
  const password = "E2epassword123!";

  await page.goto("/");
  await page.getByRole("button", { name: "Ny här? Skapa ett konto" }).click();
  await page.getByLabel("E-postadress").fill(email);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Skapa konto", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Bekräfta din e-post" })
  ).toBeVisible();

  const key = await latestVerifyKey();
  await page.goto(`/?verify_key=${encodeURIComponent(key)}`);
  await expect(
    page.getByRole("heading", { name: "E-post bekräftad!" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Till inloggningen" }).click();

  await page.getByLabel("E-postadress").fill(email);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Överblicken" })
  ).toBeVisible();
});
