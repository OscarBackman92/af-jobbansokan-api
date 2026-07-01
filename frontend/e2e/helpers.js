import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect } from "@playwright/test";

const MAIL_DIR = join(dirname(fileURLToPath(import.meta.url)), ".mail");

export const SEEDED_USER = {
  email: "e2e@example.com",
  password: "E2epassword123!",
};

/** Pull the verification key out of the newest mail file on disk. */
export async function latestVerifyKey() {
  const files = (await readdir(MAIL_DIR)).filter((f) => f.endsWith(".log")).sort();
  const newest = files.at(-1);
  if (!newest) throw new Error(`No mail files in ${MAIL_DIR}`);
  let text = await readFile(join(MAIL_DIR, newest), "utf8");
  // Undo quoted-printable artifacts in case the body was QP-encoded.
  text = text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  const match = text.match(/verify_key=([^&\s"']+)/);
  if (!match) throw new Error(`No verify_key found in ${newest}`);
  return match[1];
}

export async function login(
  page,
  email = SEEDED_USER.email,
  password = SEEDED_USER.password
) {
  await page.goto("/");
  await page.getByLabel("E-postadress").fill(email);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Överblicken" })
  ).toBeVisible();
}
