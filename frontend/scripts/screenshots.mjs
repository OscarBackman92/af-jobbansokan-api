// Visual QA: drives the current Ansokt app and saves screenshots.
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

async function clickByText(selector, text) {
  const clicked = await page.evaluate(
    ({ selector: cssSelector, text: label }) => {
      const matches = [...document.querySelectorAll(cssSelector)];
      const match = matches.find((node) => node.textContent.trim().includes(label));
      if (!match) return false;
      match.click();
      return true;
    },
    { selector, text }
  );
  if (!clicked) throw new Error(`Could not find ${selector} containing "${text}"`);
}

await page.goto(BASE, { waitUntil: "networkidle0" });
await shot("01-login");

for (const theme of ["forest", "dark"]) {
  await setTheme(theme);
  await wait(200);
  await shot(`01-login-${theme}`);
}
await setTheme("indigo");
await wait(200);

await clickByText("button", "Skapa ett konto");
const email = `visual-${Date.now()}@example.com`;
await page.type('input[type="email"]', email);
await page.type('input[type="password"]', "Visualtest123!");
await clickByText("button", "Skapa konto");
await page.waitForSelector(".empty-state, .board", { timeout: 10000 });
await wait(500);
await shot("02-board-empty");

await clickByText("button", "Fyll i CV");
await page.waitForSelector(".profile-id", { timeout: 10000 });
await wait(400);
await shot("03-profile-cv");

await clickByText("button", "Annonser");
await page.waitForSelector(".job-search", { timeout: 10000 });
await wait(800);
await shot("04-postings");

await clickByText("button", "Tavlan");
await page.waitForSelector(".empty-state, .board", { timeout: 10000 });
await clickByText("button", "Lägg till din första ansökan");
await page.waitForSelector(".modal", { timeout: 10000 });
await wait(300);
await shot("05-new-application");

await browser.close();
console.log(`Saved screenshots to ${OUT}/`);
