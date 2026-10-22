// Shared drivers for the browser suites. They play through the same controls
// a player uses: walking in the world, the story band, the journal.
import { expect } from "@playwright/test";
import { episodeById } from "../../site/stories.js";
import { defaultSeed, seedCode } from "../../site/game.js";

export const seedFor = (id) => seedCode(defaultSeed(episodeById(id)));
export const url = (id = "wisdom", extra = "") => `/?nosw&worldtest&seed=${seedFor(id)}${extra}`;

export function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

/** Open a tale. By default motion and trials are off so runs are quick and the dice decide. */
export async function enter(page, id = "wisdom", { echoes = [], motion = false, trials = false, clear = true } = {}) {
  await page.addInitScript(
    ([tale, list, settings, wipe]) => {
      if (wipe && !sessionStorage.getItem("hadithi.test.started")) {
        localStorage.clear();
        sessionStorage.setItem("hadithi.test.started", "1");
      }
      localStorage.setItem("hadithi.v1.settings", JSON.stringify({ ...JSON.parse(localStorage.getItem("hadithi.v1.settings") ?? "{}"), ...settings }));
      if (list.length) localStorage.setItem("hadithi.v1.echoes", JSON.stringify({ [tale]: list }));
    },
    [id, echoes, { motion, trials }, clear],
  );
  await page.goto(url(id));
  await page.locator(`[data-start="${id}"]`).click();
  await expect(page.locator('.world-stage[data-ready="true"]')).toBeVisible();
}

/**
 * A screenshot for review, written only when SHOTS=1. Passing runs leave
 * nothing on disk; failures keep Playwright's own artifacts.
 */
export async function shot(page, name, options = {}) {
  if (process.env.SHOTS !== "1") return;
  await page.screenshot({ path: `artifacts/${name}.png`, animations: "disabled", ...options });
}

export const save = (page, id = "wisdom") => page.evaluate((tale) => JSON.parse(localStorage.getItem(`hadithi.v1.save.${tale}`)), id);
export const world = (page) => page.evaluate(() => window.__hadithi.world());
export const story = (page) => page.evaluate(() => window.__hadithi.story());

/** Let the storyteller finish: go on until the band is idle. */
export async function settle(page) {
  for (let i = 0; i < 80; i++) {
    const s = await story(page);
    if (!s?.telling) return;
    // A chapter card goes on by itself; anything else waits for "Go on".
    if (s.beat === "chapter") await page.waitForTimeout(120);
    else await page.locator(".story-next").click();
  }
  throw new Error("the story never settled");
}

/** Walk to a place and act, exactly as a player would. */
export async function walk(page, id) {
  expect(await page.evaluate((x) => window.__hadithi.walkTo(x), id), `walk to ${id}`).toBe(true);
}

/** Replay one engine command through the interface. */
export async function perform(page, command, tale = "wisdom") {
  const before = (await save(page, tale))?.actions.length ?? 0;
  const done = () => expect.poll(async () => (await save(page, tale)).actions.length, { timeout: 15000 }).toBeGreaterThan(before);
  await settle(page);
  switch (command.type) {
    case "PUZZLE":
      await page.locator(`.story-choices [data-puzzle="${command.id}"]`).click();
      return done();
    case "CLEAR_PUZZLE":
      await page.locator(".story-choices .choice.quiet").click();
      return done();
    case "SHIFT_THEME":
      await page.keyboard.press("j");
      await page.locator("#shift-theme").click();
      await page.locator(`[data-theme="${command.id}"]`).click();
      return done();
    case "COMBINE":
      await page.keyboard.press("b");
      await page.locator(`[data-recipe="${command.id}"]`).click();
      return done();
    case "DEDUCE":
      await page.keyboard.press("k");
      for (const id of command.ids) await page.locator(`[data-clue="${id}"]`).click();
      await page.locator("#connect").click();
      return done();
    default: {
      const placed = await page.evaluate((x) => window.__hadithi.placed(x), command.id);
      if (placed) await walk(page, command.id);
      else await page.locator(`.story-choices [data-choice="${command.id}"]`).click();
      return done();
    }
  }
}
