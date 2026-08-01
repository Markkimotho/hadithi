import { test, expect } from "@playwright/test";
import { walkthroughs, commandsOf } from "../walkthroughs.js";
import { episodeById } from "../../site/stories.js";
import { defaultSeed, seedCode } from "../../site/game.js";

const seedFor = (id) => seedCode(defaultSeed(episodeById(id)));
const url = (id, extra = "") => `/?nosw&seed=${seedFor(id)}${extra}`;

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

async function enter(page, id, { echoes = [] } = {}) {
  if (echoes.length)
    await page.addInitScript(
      ([tale, list]) => localStorage.setItem("hadithi.v1.echoes", JSON.stringify({ [tale]: list })),
      [id, echoes],
    );
  await page.goto(url(id));
  await page.locator(`[data-start="${id}"]`).click();
  await expect(page.locator("#scene-title")).toBeVisible();
}

/** Replays one engine command through the visible controls. */
async function perform(page, command) {
  switch (command.type) {
    case "PUZZLE":
      return page.locator(`[data-puzzle="${command.id}"]`).click();
    case "CLEAR_PUZZLE":
      return page.locator("#clear-puzzle").click();
    case "SHIFT_THEME":
      await page.locator("#shift-theme").click();
      return page.locator(`[data-theme="${command.id}"]`).click();
    case "COMBINE":
      await page.locator('[data-panel="inventory"]').click();
      return page.locator(`[data-recipe="${command.id}"]`).click();
    case "DEDUCE":
      await page.locator('[data-panel="mind"]').click();
      for (const id of command.ids) await page.locator(`[data-clue="${id}"]`).click();
      return page.locator("#connect").click();
    default:
      return page.locator(`.actions [data-action="${command.id}"]`).click();
  }
}

test.describe("every walkthrough plays through the real interface", () => {
  for (const w of walkthroughs) {
    test(`${w.episode}: ${w.name}`, async ({ page }, info) => {
      test.skip(info.project.name === "mobile" && !w.echoes, "phone covers the secret endings");
      const errors = watchErrors(page);
      await enter(page, w.episode, { echoes: w.echoes ?? [] });
      for (const command of commandsOf(w)) await perform(page, command);
      const ending = episodeById(w.episode).endings[w.expect.ending];
      await expect(page.getByRole("heading", { name: ending.title })).toBeVisible();
      await expect(page.getByText("JOURNEY COMPLETE").first()).toBeVisible();
      for (const m of w.expect.marks ?? []) {
        const mark = episodeById(w.episode).marks.find((x) => x.id === m);
        await expect(page.locator(".mark-chips")).toContainText(mark.title);
      }
      expect(errors).toEqual([]);
    });
  }
});

test("collection, filters, sources, chronicle and layout", async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto("/?nosw");
  await expect(page.getByRole("heading", { name: /Every story has/ })).toBeVisible();
  await expect(page.locator(".story-card")).toHaveCount(4);
  await expect(page.locator(".intro-meta")).toContainText("12 ENDINGS + 04 SECRETS");
  await page.screenshot({ path: `artifacts/collection-${info.project.name}.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Middle East", exact: true }).click();
  await expect(page.locator(".story-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "The Olive Jar" })).toBeVisible();
  await page.getByRole("button", { name: "All tales", exact: true }).click();
  await page.locator("#footer-sources").click();
  await expect(page.getByRole("heading", { name: "Where the stories began" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the source collection ↗" })).toHaveCount(4);
  await expect(page.locator("dialog")).toContainText("Hanna Diyab");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator("#shelf-chronicle").click();
  await expect(page.getByRole("heading", { name: "The chronicle" })).toBeVisible();
  await expect(page.locator(".ending-list .secret")).toHaveCount(4);
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("dice show odds first, roll visibly, and undo cannot reroll", async ({ page }, info) => {
  await enter(page, "wisdom");
  for (const id of ["trail", "river", "ford"]) await perform(page, { id });
  const leap = page.locator('.actions [data-action="leap"]');
  await expect(leap).toContainText(/INSIGHT \d+% · ONE TRY/);
  await expect(leap).toContainText("need 8");
  await leap.click();
  const tray = page.locator(".dice-tray");
  await expect(tray).toBeVisible();
  const first = await tray.getAttribute("aria-label");
  expect(first).toMatch(/Insight check: rolled \d and \d/);
  await page.screenshot({ path: `artifacts/dice-${info.project.name}.png`, fullPage: true, animations: "disabled" });
  await page.locator("#undo").click();
  await expect(page.getByRole("heading", { name: "Measure before you leap" })).toBeVisible();
  await perform(page, { id: "leap" });
  await expect(page.locator(".dice-tray")).toHaveAttribute("aria-label", first);
  await perform(page, { id: "back" });
  await expect(page.locator('.actions [data-action="leap"]')).toHaveCount(0);
});

test("connecting clues in the Mind opens a new conversation", async ({ page }, info) => {
  await enter(page, "wisdom");
  for (const id of ["tracks", "market", "listen"]) await perform(page, { id });
  await page.locator('[data-panel="mind"]').click();
  await expect(page.locator("#connect")).toBeDisabled();
  await page.locator('[data-clue="load"]').click();
  await page.locator('[data-clue="carry"]').click();
  await expect(page.locator("#connect")).toBeEnabled();
  await page.locator("#connect").click();
  await expect(page.locator(".conclusion")).toContainText("He carries it where he can watch it");
  await expect(page.locator(".consequence.deduction-note")).toBeVisible();
  await expect(page.getByText("TURN 02", { exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/mind-${info.project.name}.png`, fullPage: true, animations: "disabled" });
  for (const id of ["home", "trail", "river", "ford", "wade", "tree"]) await perform(page, { id });
  await expect(page.locator('.actions [data-action="behind"]')).toBeVisible();
});

test("an ending teaches an echo that appears as a remembered action next time", async ({ page }) => {
  await enter(page, "wisdom");
  for (const command of commandsOf(walkthroughs.find((w) => w.expect.ending === "scattered"))) await perform(page, command);
  await expect(page.locator(".echo-card.new")).toContainText("The child’s story");
  await page.locator("#retell").click();
  await expect(page.locator("#carry-now")).toBeChecked();
  await page.locator("#begin-fresh").click();
  await expect(page.locator(".echo-count")).toContainText("◈ 1");
  for (const id of ["trail", "river", "ford", "wade", "tree"]) await perform(page, { id });
  const remembered = page.locator('.actions [data-action="childStory"]');
  await expect(remembered).toContainText("◈ REMEMBERED");
  await page.locator("#back-library").click();
  await expect(page.locator(".story-card.wisdom .card-progress")).toContainText("◈ 1 ECHO");
  await expect(page.locator(".story-card.wisdom .slot.found")).toHaveCount(1);
});

test("the map shows discovered places and travels by road", async ({ page }) => {
  await enter(page, "orchestra");
  await page.locator('[data-panel="map"]').click();
  await expect(page.locator(".map-svg .node")).toHaveCount(1);
  await expect(page.locator(".map-svg .unknown")).toHaveCount(1);
  await page.locator('[data-travel="dog"]').click();
  await expect(page.getByRole("heading", { name: "The first other voice" })).toBeVisible();
  await page.locator('[data-panel="map"]').click();
  await expect(page.locator(".map-svg .node")).toHaveCount(2);
  await expect(page.locator(".map-svg .edge")).toHaveCount(1);
  await page.locator('[data-panel="people"]').click();
  await expect(page.locator(".people-list")).toContainText("The dog");
});

test("crafting, genre shift, autosave and resume", async ({ page }) => {
  await enter(page, "wisdom");
  for (const id of ["takeCord", "market", "takeCloth"]) await perform(page, { id });
  await perform(page, { type: "COMBINE", id: "sling" });
  await page.getByRole("button", { name: "Carrying sling", exact: true }).click();
  await expect(page.locator(".item-detail")).toContainText("leaves both hands free");
  await perform(page, { type: "SHIFT_THEME", id: "mystery" });
  await expect(page.locator(".theme-box")).toContainText("Mystery");
  await page.reload();
  await page.getByRole("button", { name: /Resume journey/ }).click();
  await expect(page.getByRole("heading", { name: "Things people know" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Carrying sling", exact: true })).toBeVisible();
  await expect(page.locator(".theme-box")).toContainText("Mystery");
});

test("keyboard play, sound toggle, and comfort settings persist", async ({ page }) => {
  await enter(page, "wisdom");
  await page.keyboard.press("1");
  await expect(page.locator(".consequence").first()).toContainText("heavy load");
  await page.keyboard.press("j");
  await expect(page.locator("#tab-mind")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("u");
  await expect(page.locator(".clue-list li")).toHaveCount(0);
  await page.keyboard.press("s");
  await expect(page.locator("#sound-link")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Open game settings" }).click();
  await page.getByLabel("Scene motion").uncheck();
  await page.getByLabel("Story text size").selectOption("larger");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-motion", "off");
  await expect(page.locator("body")).toHaveAttribute("data-text", "larger");
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-motion", "off");
  await expect(page.locator("#sound-link")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("?");
  await expect(page.getByRole("heading", { name: "How a telling works" })).toBeVisible();
});

test("reduced-motion players get a still scene", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(url("tide"));
  await expect(page.locator("body")).toHaveAttribute("data-motion", "off");
  await page.locator('[data-start="tide"]').click();
  await perform(page, { id: "untie" });
  await perform(page, { id: "channel" });
  await expect(page.locator(".scene-stage")).toHaveAttribute("data-weather", "bubbles");
  await context.close();
});

test("portable save export and import reconstruct the journey", async ({ page }) => {
  await enter(page, "olives");
  await perform(page, { id: "takeOlive" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export save ↓" }).click();
  const file = await (await download).path();
  await page.getByRole("button", { name: "Open game settings" }).click();
  await page.locator("#import-file").setInputFiles(file);
  await expect(page.getByRole("heading", { name: "Seven years and a plate of olives" })).toBeVisible();
  await page.locator('[data-panel="inventory"]').click();
  await expect(page.getByRole("button", { name: "Olive from the jar", exact: true })).toBeVisible();
});

test("first-edition saves are carried forward; unknown editions start fresh", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "hadithi.v1.save.wisdom",
      JSON.stringify({ version: 1, episodeId: "wisdom", revision: 1, actions: [{ type: "TRAVEL", id: "market" }] }),
    );
    localStorage.setItem(
      "hadithi.v1.save.tide",
      JSON.stringify({ version: 0, episodeId: "tide", revision: 0, actions: [] }),
    );
  });
  await page.goto("/?nosw");
  await page.locator('[data-start="wisdom"]').click();
  await expect(page.getByRole("heading", { name: "Things people know" })).toBeVisible();
  await expect(page.locator("#toast")).toContainText("carried into this edition");
  await page.locator("#back-library").click();
  await page.locator('[data-start="tide"]').click();
  await expect(page.getByRole("heading", { name: "A different edition" })).toBeVisible();
  await page.getByRole("button", { name: "Start a new journey →" }).click();
  await expect(page.getByRole("heading", { name: "A life in a loop" })).toBeVisible();
});

test("the built site installs a service worker and plays offline", async ({ page, context }, info) => {
  test.skip(info.project.name === "mobile", "one offline check is enough");
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".story-card")).toHaveCount(4);
  await page.locator('[data-start="olives"]').click();
  await expect(page.locator(".scene-image")).toHaveJSProperty("complete", true);
  expect(await page.locator(".scene-image").evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  await context.setOffline(false);
});

test("no serious accessibility violations on the shelf, a scene, the mind, and an ending", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const audit = async (where) => {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = result.violations.filter((v) => ["serious", "critical"].includes(v.impact));
    expect(serious.map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  };
  // Audit settled colours, not mid-transition frames.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url("olives"));
  await audit("shelf");
  await page.locator('[data-start="olives"]').click();
  await perform(page, { id: "hear" });
  await perform(page, { id: "borrow" });
  await audit("scene with dice");
  for (const tab of ["mind", "people", "map"]) {
    await page.locator(`[data-panel="${tab}"]`).click();
    await audit(tab);
  }
  for (const command of commandsOf(walkthroughs.find((w) => w.expect.ending === "dismissed"))) {
    if (command.id === "hear" || command.id === "borrow") continue;
    await perform(page, command);
  }
  await expect(page.getByText("JOURNEY COMPLETE").first()).toBeVisible();
  await audit("ending");
  await page.locator("#open-chronicle").click();
  await audit("chronicle");
});
