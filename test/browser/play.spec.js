// The story-first play screen: the storyteller, conversations, the journal,
// endings, saves, and every Wisdom walkthrough played through the world.
import { test, expect } from "@playwright/test";
import { walkthroughs, commandsOf } from "../walkthroughs.js";
import { episodeById, episodes } from "../../site/stories.js";
import { url, enter, save, story, settle, walk, perform, watchErrors } from "./helpers.js";

const wisdom = episodeById("wisdom");
/** Tales with a world for every scene. The shelf test checks this list against the game. */
const PLAYABLE = ["wisdom", "tide"];

for (const tale of PLAYABLE)
  test.describe(`every ${tale} walkthrough is played through the world`, () => {
    const ep = episodeById(tale);
    for (const w of walkthroughs.filter((x) => x.episode === tale)) {
      test(w.name, async ({ page }, info) => {
        test.skip(info.project.name === "mobile" && !w.echoes, "the phone plays the secret ending");
        test.setTimeout(300000);
        const errors = watchErrors(page);
        await enter(page, tale, { echoes: w.echoes ?? [] });
        for (const command of commandsOf(w)) await perform(page, command, tale);
        await settle(page);
        await expect(page.locator(".ending-page h1")).toHaveText(ep.endings[w.expect.ending].title);
        for (const m of w.expect.marks ?? []) await expect(page.locator(".mark-chips")).toContainText(ep.marks.find((x) => x.id === m).title);
        expect(errors).toEqual([]);
      });
    }
  });

test("the shelf offers only tales with a world, and keeps the others in view", async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto("/?nosw");
  await expect(page.getByRole("heading", { name: /Four old stories/ })).toBeVisible();
  await expect(page.locator(".story-card")).toHaveCount(4);
  for (const tale of PLAYABLE) await expect(page.locator(`[data-start="${tale}"]`)).toBeVisible();
  for (const ep of episodes.filter((e) => !PLAYABLE.includes(e.id))) {
    await expect(page.locator(`.story-card.${ep.id}`)).toHaveClass(/retelling/);
    await expect(page.locator(`[data-start="${ep.id}"]`)).toHaveCount(0);
  }
  await page.screenshot({ path: `artifacts/collection-${info.project.name}.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Middle East", exact: true }).click();
  await expect(page.locator(".story-card")).toHaveCount(1);
  await page.getByRole("button", { name: "All tales", exact: true }).click();
  await page.locator("#footer-sources").click();
  await expect(page.getByRole("link", { name: "Read the source collection ↗" })).toHaveCount(4);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator("#shelf-chronicle").click();
  await expect(page.locator(".ending-list .secret")).toHaveCount(4);
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("a telling opens with the storyteller: opening line, chapter card, the scene, then what you want", async ({ page }, info) => {
  const errors = watchErrors(page);
  await enter(page, "wisdom", { motion: true });
  // The site chrome steps aside; the world fills the screen.
  await expect(page.locator(".masthead")).toBeHidden();
  await expect(page.locator(".story-band")).toHaveAttribute("data-tone", "opening");
  await expect(page.locator(".story-line")).toContainText("ask him for advice.", { timeout: 6000 });
  await page.keyboard.press("Space");
  await expect(page.locator(".play-chapter h2")).toHaveText(wisdom.scenes.courtyard.title);
  await page.screenshot({ path: `artifacts/chapter-${info.project.name}.png`, animations: "disabled" });
  await expect(page.locator(".story-band")).toHaveAttribute("data-tone", "scene", { timeout: 4000 });
  await expect(page.locator(".story-line")).toContainText("Cold ash");
  await expect(page.locator(".story-line")).toContainText(wisdom.scenes.courtyard.text.slice(-12), { timeout: 6000 });
  await page.keyboard.press("Space");
  await expect(page.locator(".story-band")).toHaveAttribute("data-state", "idle");
  await expect(page.locator(".story-want")).toHaveText(wisdom.objective);
  expect(errors).toEqual([]);
});

test("looking notes the clue; taking something sends it to the bag", async ({ page }) => {
  await enter(page);
  await settle(page);
  await walk(page, "tracks");
  await expect(page.locator(".story-notes")).toContainText("You noted");
  await expect(page.locator(".story-notes")).toContainText("Insight +1");
  await expect(page.locator(".journal-dot")).toBeVisible();
  expect((await save(page)).actions.at(-1)).toEqual({ type: "INSPECT", id: "tracks" });
  await settle(page);
  await walk(page, "takeCord");
  await expect(page.locator(".story-notes")).toContainText("Into your bag: Palm cord");
  await page.keyboard.press("b");
  await expect(page.locator(".journal-drawer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Palm cord" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".journal-drawer")).toBeHidden();
});

test("a person with several things to say opens a conversation; their words appear above them", async ({ page }, info) => {
  await enter(page, "wisdom", { motion: true });
  await settle(page);
  await walk(page, "market");
  await settle(page);
  await walk(page, "potter");
  await expect(page.locator(".story-band")).toHaveAttribute("data-state", "conversation");
  await expect(page.locator(".story-speaker")).toHaveText("The potter");
  const lines = page.locator(".story-choices .choice:not(.quiet)");
  await expect(lines).toHaveCount(2); // the remembered line needs an echo
  await page.screenshot({ path: `artifacts/conversation-${info.project.name}.png`, animations: "disabled" });
  await page.keyboard.press("1");
  await expect(page.locator(".play-bubble")).toBeVisible();
  await expect(page.locator(".play-bubble b")).toHaveText("The potter");
  expect((await save(page)).actions.at(-1).id).toBe("secret");
});

test("putting two things together is told as a discovery and opens a new line", async ({ page }) => {
  await enter(page);
  for (const id of ["tracks", "market", "listen"]) await perform(page, { id });
  await settle(page);
  await page.keyboard.press("k");
  await expect(page.locator("#connect")).toBeDisabled();
  await page.locator('[data-clue="load"]').click();
  await page.locator('[data-clue="carry"]').click();
  await page.locator("#connect").click();
  await expect(page.locator(".story-deduction")).toBeVisible();
  await settle(page);
  for (const id of ["home", "trail", "river", "ford", "wade", "tree"]) await perform(page, { id });
  await settle(page);
  expect(await page.evaluate(() => window.__hadithi.placed("behind"))).toBe(true);
});

test("an ending is a closing page; its echo is remembered in the next telling", async ({ page }) => {
  await enter(page);
  for (const command of commandsOf(walkthroughs.find((w) => w.expect.ending === "scattered"))) await perform(page, command);
  await settle(page);
  await expect(page.locator(".ending-page")).toBeVisible();
  await expect(page.locator(".echo-card.new")).toContainText("The child’s story");
  await page.locator("#retell").click();
  await expect(page.locator("#carry-now")).toBeChecked();
  await page.locator("#begin-fresh").click();
  await expect(page.locator('.world-stage[data-ready="true"]')).toBeVisible();
  for (const id of ["trail", "river", "ford", "wade", "tree"]) await perform(page, { id });
  await settle(page);
  await walk(page, "childStory");
  await expect.poll(async () => (await save(page)).actions.at(-1).id).toBe("childStory");
  await page.locator("#back-library").click();
  await expect(page.locator(".story-card.wisdom .card-progress")).toContainText("◈ 1 echo");
});

test("a trial is played in the world, by hand, and its outcome is what the story records", async ({ page }, info) => {
  await enter(page, "wisdom", { trials: true, motion: true });
  for (const id of ["trail", "river", "ford"]) await perform(page, { id });
  await settle(page);
  page.evaluate(() => window.__hadithi.walkTo("leap"));
  await expect.poll(async () => (await page.evaluate(() => window.__hadithi.world()))?.trial?.kind, { timeout: 20000 }).toBe("leap");
  await expect(page.locator(".story-band")).toHaveAttribute("data-tone", "trial");
  await expect(page.locator(".trial-hint")).toContainText("ring closes");
  await page.screenshot({ path: `artifacts/trial-${info.project.name}.png`, animations: "disabled" });
  // Press as each ring closes on its stone.
  for (let i = 0; i < 600; i++) {
    const t = (await page.evaluate(() => window.__hadithi.world()))?.trial;
    if (!t || t.done) break;
    if (t.next !== null && t.next < 0.03) await page.keyboard.press("Space");
    await page.waitForTimeout(10);
  }
  await expect.poll(async () => (await save(page)).actions.at(-1).id, { timeout: 10000 }).toBe("leap");
  const command = (await save(page)).actions.at(-1);
  expect(command.outcome.mode).toBe("skill");
  expect(command.outcome.score).toBeGreaterThan(0);
  await expect(page.locator(".story-roll .dice-tray")).toBeVisible();
});

test("stepping back from a trial leaves the story untouched", async ({ page }) => {
  await enter(page, "wisdom", { trials: true });
  for (const id of ["trail", "river", "ford"]) await perform(page, { id });
  await settle(page);
  const before = (await save(page)).actions.length;
  page.evaluate(() => window.__hadithi.walkTo("leap"));
  await expect(page.locator(".story-band")).toHaveAttribute("data-tone", "trial", { timeout: 20000 });
  await page.getByRole("button", { name: "Step back" }).click();
  await expect(page.locator(".story-band")).toHaveAttribute("data-state", "idle");
  expect((await save(page)).actions.length).toBe(before);
  expect((await page.evaluate(() => window.__hadithi.world())).trial).toBeNull();
});

test("with trials off the dice decide, and taking a step back cannot change them", async ({ page }) => {
  await enter(page);
  for (const id of ["trail", "river", "ford"]) await perform(page, { id });
  await settle(page);
  await walk(page, "leap");
  const tray = page.locator(".story-roll .dice-tray");
  await expect(tray).toBeVisible();
  const first = await tray.getAttribute("aria-label");
  expect((await save(page)).actions.at(-1).outcome).toBeUndefined();
  await page.keyboard.press("u");
  await expect(page.locator('.world-stage')).toHaveAttribute("data-scene", "ford");
  await settle(page);
  await walk(page, "leap");
  await expect(page.locator(".story-roll .dice-tray")).toHaveAttribute("aria-label", first);
});

test("the journal holds the bag, what you know, people, the map, and the turn of the tale", async ({ page }) => {
  await enter(page);
  for (const id of ["takeCord", "market", "takeCloth"]) await perform(page, { id });
  await perform(page, { type: "COMBINE", id: "sling" });
  await page.keyboard.press("b");
  await page.getByRole("button", { name: "Carrying sling", exact: true }).click();
  await expect(page.locator(".item-detail")).toContainText("leaves both hands free");
  await page.locator("#tab-people").click();
  await expect(page.locator(".people-list")).toContainText("potter");
  await page.locator("#tab-map").click();
  await expect(page.locator(".map-svg .node")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await perform(page, { type: "SHIFT_THEME", id: "mystery" });
  await page.reload();
  await page.locator('[data-start="wisdom"]').click();
  await expect(page.locator('.world-stage[data-ready="true"]')).toHaveAttribute("data-scene", "market");
  await page.keyboard.press("j");
  await expect(page.locator(".journal-turn")).toContainText("Mystery");
});

test("shared ground: the well is part of the market, and its choices sit in the story band", async ({ page }) => {
  await enter(page);
  for (const id of ["market", "takeGourd"]) await perform(page, { id });
  await perform(page, { id: "well" });
  await expect(page.locator(".world-stage")).toHaveAttribute("data-scene", "well");
  const atWell = (await page.evaluate(() => window.__hadithi.world())).position;
  await perform(page, { id: "fill" });
  await perform(page, { id: "back" });
  await expect(page.locator(".world-stage")).toHaveAttribute("data-scene", "market");
  const back = (await page.evaluate(() => window.__hadithi.world())).position;
  expect(Math.hypot(back.x - atWell.x, back.y - atWell.y)).toBeLessThan(0.4);
});

test("comfort settings persist and the guide explains walking and trials", async ({ page }) => {
  await page.goto("/?nosw");
  await page.getByRole("button", { name: "Open game settings" }).click();
  await page.getByLabel("Scene motion").uncheck();
  await page.getByLabel("Physical trials").uncheck();
  await page.getByLabel("Story text size").selectOption("larger");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-text", "larger");
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-motion", "off");
  await page.keyboard.press("?");
  await expect(page.getByRole("heading", { name: "How a telling works" })).toBeVisible();
  await expect(page.locator("dialog")).toContainText("Walk anywhere");
  await expect(page.locator("dialog")).not.toContainText("Classic");
});

test("portable save export and import reconstruct the journey", async ({ page }) => {
  await enter(page);
  await perform(page, { id: "takeCord" });
  await page.keyboard.press("j");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export save ↓" }).click();
  const file = await (await download).path();
  await page.keyboard.press("Escape");
  await page.locator("#back-library").click();
  await page.evaluate(() => localStorage.removeItem("hadithi.v1.save.wisdom"));
  await page.getByRole("button", { name: "Open game settings" }).click();
  await page.locator("#import-file").setInputFiles(file);
  await expect(page.locator('.world-stage[data-ready="true"]')).toBeVisible();
  expect((await save(page)).actions).toEqual([{ type: "TAKE_ITEM", id: "takeCord" }]);
});

test("first-edition saves are carried forward; unknown editions start fresh", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hadithi.v1.settings", JSON.stringify({ motion: false }));
    localStorage.setItem("hadithi.v1.save.wisdom", JSON.stringify({ version: 1, episodeId: "wisdom", revision: 1, actions: [{ type: "TRAVEL", id: "market" }] }));
  });
  await page.goto(url());
  await page.locator('[data-start="wisdom"]').click();
  await expect(page.locator('.world-stage[data-ready="true"]')).toHaveAttribute("data-scene", "market");
  await expect(page.locator("#toast")).toContainText("carried into this edition");
  await page.locator("#back-library").click();
  await page.evaluate(() => localStorage.setItem("hadithi.v1.save.wisdom", JSON.stringify({ version: 0, episodeId: "wisdom", revision: 0, actions: [] })));
  await page.locator('[data-start="wisdom"]').click();
  await expect(page.getByRole("heading", { name: "A different edition" })).toBeVisible();
  await page.getByRole("button", { name: "Start a new journey →" }).click();
  await expect(page.locator('.world-stage[data-ready="true"]')).toHaveAttribute("data-scene", "courtyard");
});

test("no serious accessibility violations on the shelf, the tale, the journal and an ending", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const audit = async (where) => {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = result.violations.filter((v) => ["serious", "critical"].includes(v.impact));
    expect(serious.map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?nosw");
  await audit("shelf");
  await enter(page);
  await audit("telling");
  await settle(page);
  await audit("idle");
  for (const key of ["b", "k", "p", "m"]) {
    await page.keyboard.press(key);
    await audit(`journal ${key}`);
  }
  await page.keyboard.press("Escape");
  for (const command of commandsOf(walkthroughs.find((w) => w.expect.ending === "scattered"))) await perform(page, command);
  await settle(page);
  await audit("ending");
});

/** Every visible text node with its computed size, outside SVG art and the canvas. */
const textSizes = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => !el.closest("svg") && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && !el.closest("[hidden]"))
      .map((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), text: el.textContent.trim().slice(0, 40) })),
  );

test("all text is at least 14px and nothing scrolls sideways at 320px", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sets its own viewports");
  const check = async (name, width) => {
    expect((await textSizes(page)).filter((t) => t.size < 14), `${name} at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${name} at ${width}px`).toBeLessThanOrEqual(0);
  };
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/?nosw");
    await page.evaluate(() => document.fonts.ready);
    await check("shelf", width);
    await enter(page);
    await check("telling", width);
    await settle(page);
    for (const key of ["b", "k", "p", "m"]) {
      await page.keyboard.press(key);
      await check(`journal ${key}`, width);
    }
    await page.keyboard.press("Escape");
    await page.locator("#back-library").click();
  }
  expect(await page.locator(".story-line").count()).toBe(0);
});
