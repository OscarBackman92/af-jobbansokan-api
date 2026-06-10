// Visual QA: drives the app through real flows and saves screenshots.
// Usage: node scripts/screenshots.mjs [outdir]   (default: ./shots)
// Requires the Vite dev server on :5173 and Django on :8000.

import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const OUT = process.argv[2] || "shots";
const BASE = "http://localhost:5173";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE_PATHS[0],
  headless: "new",
  defaultViewport: { width: 1366, height: 1000 },
});

const page = await browser.newPage();
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const setTheme = (theme) =>
  page.evaluate((value) => {
    localStorage.setItem("theme", value);
    document.documentElement.dataset.theme = value;
  }, theme);

await page.goto(BASE, { waitUntil: "networkidle0" });
await shot("01-login");

// Theme variants of the login view
for (const theme of ["forest", "dark"]) {
  await setTheme(theme);
  await wait(200);
  await shot(`01-login-${theme}`);
}
await setTheme("indigo");
await wait(200);

// BankID login
await page.type('input[placeholder="ÅÅÅÅMMDD-NNNN"]', "19900101-2384");
await page.click("form button");
await page.waitForSelector("table", { timeout: 10000 }).catch(() => {});
await wait(800);
await shot("02-applicant");

// Posting detail modal
const linklike = await page.$(".linklike");
if (linklike) {
  await linklike.click();
  await page.waitForSelector(".modal", { timeout: 5000 }).catch(() => {});
  await wait(600);
  await shot("03-posting-detail");
  await page.keyboard.press("Escape");
  const close = await page.$(".modal .secondary");
  if (close) await close.click();
  await wait(300);
}

// Employer tab
const tabs = await page.$$(".tab");
await tabs[1].click();
await wait(400);
await shot("04-employer-login");

// Partner tab
await tabs[2].click();
await wait(400);
await shot("05-partner");

await browser.close();
console.log(`Saved screenshots to ${OUT}/`);
