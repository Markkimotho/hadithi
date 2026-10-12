#!/usr/bin/env node
// Open the game in Chrome, enter a tale, walk and turn a little, and save
// screenshots to artifacts/look/ (not committed) with any page errors
// printed. For checking the look of a change by eye. Needs `npm run dev`.
//
//   node scripts/look.mjs [tale]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
const out = "artifacts/look";
mkdirSync(out, { recursive: true });
const tale = process.argv[2] ?? "wisdom";
const base = process.env.BASE ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/?nosw&worldtest`);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/title.png` });
await page.locator(`[data-start="${tale}"]`).click();
await page.locator('.world-stage[data-ready="true"]').waitFor({ timeout: 15000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/play1.png` });
for (let i = 0; i < 6; i++) { const s = await page.evaluate(() => window.__hadithi.story()); if (!s?.telling) break; if (s.beat === "chapter") await page.waitForTimeout(400); else await page.locator(".story-next").click(); }
await page.keyboard.down("w"); await page.waitForTimeout(700); await page.keyboard.up("w");
await page.keyboard.down("ArrowRight"); await page.waitForTimeout(500); await page.keyboard.up("ArrowRight");
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/play2.png` });
console.log(JSON.stringify(await page.evaluate(() => window.__hadithi.world())).slice(0, 600));
console.log("errors", errors);
await browser.close();
