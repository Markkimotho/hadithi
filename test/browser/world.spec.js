import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { enter, save, world as state, walk, settle, perform } from "./helpers.js";

test("the world loads on entry, walking needs no click, and dialogs and the journal pause it", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/?nosw&worldtest");
  expect(requests.some((u) => u.includes("phaser.esm"))).toBe(false);
  await enter(page);
  await expect(page.locator(".world-stage")).toHaveAttribute("data-light", "dawn");
  await expect(page.locator(".world-weather")).toBeVisible();
  const before = await state(page), initialSave = await save(page);
  expect(before.art.tiles).toBeGreaterThan(1);
  expect(before.art.kweku).toBe(1);
  // No click into the canvas: the keys walk straight away.
  await page.keyboard.down("d");
  await expect.poll(async () => (await state(page)).position.x).toBeGreaterThan(before.position.x + 0.7);
  await page.keyboard.up("d");
  expect((await save(page)).actions).toEqual(initialSave.actions);
  // Let him come to rest, so any later movement can only come from input.
  let last = null;
  await expect.poll(async () => {
    const now = JSON.stringify((await state(page)).position);
    const still = now === last;
    last = now;
    return still;
  }, { intervals: [150] }).toBe(true);
  await page.locator("#story-source").click();
  const paused = await state(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  expect((await state(page)).position).toEqual(paused.position);
  await page.locator("#close-modal").click();
  await page.keyboard.press("j");
  await page.keyboard.down("a");
  await page.waitForTimeout(300);
  await page.keyboard.up("a");
  expect((await state(page)).position).toEqual(paused.position);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `artifacts/world-${info.project.name}.png`, animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("travel through an exit, then resume where you stood in the story", async ({ page }) => {
  await enter(page);
  await perform(page, { id: "tracks" });
  await perform(page, { id: "market" });
  await expect(page.locator(".world-stage")).toHaveAttribute("data-scene", "market");
  const saved = await save(page);
  await page.reload();
  await page.locator('[data-start="wisdom"]').click();
  await expect(page.locator('.world-stage[data-ready="true"]')).toHaveAttribute("data-scene", "market");
  expect((await save(page)).actions).toEqual(saved.actions);
});

test("signposts name the roads, and undo walks the story back to the courtyard", async ({ page }) => {
  await enter(page);
  await perform(page, { id: "trail" });
  await expect(page.locator('.world-stage[data-scene="trail"]')).toBeVisible();
  await settle(page);
  await expect(page.locator('.world-marker.world-exit').first()).toBeVisible();
  await page.locator("#undo").click();
  await expect(page.locator('.world-stage[data-ready="true"]')).toHaveAttribute("data-scene", "courtyard");
});

test("the scale challenge uses discovered evidence and settles the chosen weight", async ({ page }) => {
  await page.goto("/?nosw&worldtest");
  await page.evaluate(async () => {
    const { runSkillChallenge } = await import("./world/skill-challenge.js");
    const root = document.createElement("div"); document.body.append(root);
    window.scaleResult = runSkillChallenge({ root, skillActive: false, motion: false }, "scale", {
      chance: 0.7, skill: { patience: 4 }, clues: ["promiseSeal"],
      deductions: ["selfSealed"], flags: ["savedWhisper"], stats: {},
    });
  });
  const modal = page.locator(".world-skill");
  await expect(modal.getByRole("button", { name: /new seal was his promise/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: /gourd kept one voice/ })).toBeVisible();
  await modal.getByRole("button", { name: /new seal was his promise/ }).click();
  await modal.getByRole("button", { name: /gourd kept one voice/ }).click();
  await expect(modal.locator(".scale-total")).toHaveText("Weight: 4 · Balance: 4");
  await modal.getByRole("button", { name: "Set the scale" }).click();
  const result = await page.evaluate(() => window.scaleResult);
  expect(result).toEqual({ mode: "skill", pass: true, score: 1 });
});

test("the balance challenge moves its safe point when the pot rides behind", async ({ page }) => {
  await page.goto("/?nosw&worldtest");
  await page.evaluate(async () => {
    const { runSkillChallenge } = await import("./world/skill-challenge.js");
    const root = document.createElement("div"); document.body.append(root);
    window.balanceResult = runSkillChallenge({ root, skillActive: false, motion: false }, "balance", {
      chance: 0.65, assist: false, flags: ["behind"], stats: {},
    });
  });
  const modal = page.locator(".world-skill");
  await expect(modal.locator(".skill-instructions")).toContainText("rides against your back");
  await expect(modal.locator(".balance-sweetspot")).toHaveAttribute("style", /left:\s*42%/);
  await modal.getByRole("button", { name: "Leave the challenge" }).click();
  expect(await page.evaluate(() => window.balanceResult)).toBeNull();
});

test("tap to move and touch joystick drive the same physical player", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch input");
  await enter(page);
  const p = await state(page);
  await settle(page);
  const stick = await page.locator(".world-joystick").boundingBox();
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
  await page.mouse.down();
  await page.mouse.move(stick.x + stick.width - 5, stick.y + stick.height / 2);
  await expect.poll(async () => (await state(page)).position.x).toBeGreaterThan(p.position.x + 0.6);
  await page.mouse.up();
  const viewport = await page.locator(".world-stage").boundingBox();
  await page.touchscreen.tap(viewport.x + viewport.width / 2, viewport.y + viewport.height * 0.3);
  await expect.poll(async () => (await state(page)).walking).toBe(true);
});

test("gamepad movement and world accessibility", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one gamepad and accessibility audit");
  await enter(page);
  const p = await state(page);
  await page.evaluate(() => {
    window.testPad = { connected: true, axes: [1, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [window.testPad] });
  });
  await expect.poll(async () => (await state(page)).position.x).toBeGreaterThan(p.position.x + 0.6);
  await page.evaluate(() => { window.testPad.axes = [0, 0]; });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("a loose jar can be lifted and thrown without spending story turns", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one physical interaction check");
  await enter(page);
  await settle(page);
  await page.keyboard.down("ArrowDown");
  await expect.poll(async () => (await state(page)).position.y, { intervals: [30] }).toBeGreaterThan(12.25);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await state(page)).position.x, { intervals: [30] }).toBeGreaterThan(22);
  await page.keyboard.up("ArrowRight");
  await expect(page.locator(".play-prompt")).toContainText("lift");
  await page.keyboard.press("q");
  await expect.poll(async () => (await state(page)).props.some((p) => p.carried)).toBe(true);
  const held = (await state(page)).props.find((p) => p.carried);
  await page.keyboard.press("f");
  // The jar flies off on its own. Whether it cracks depends on the wall it
  // meets; test/physics.test.js checks cracking exactly.
  await expect.poll(async () => {
    const jar = (await state(page)).props.find((p) => p.id === held.id);
    return !jar.carried && Math.hypot(jar.x - held.x, jar.y - held.y) > 0.8;
  }).toBe(true);
  expect((await save(page)).actions).toEqual([]);
});

test("the world and its fonts load offline from the production cache", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "one offline world check");
  await page.goto("http://127.0.0.1:4174/?worldtest");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.locator('[data-start="wisdom"]').click();
  await expect(page.locator('.world-stage[data-ready="true"]')).toBeVisible();
  await settle(page);
  await walk(page, "tracks");
  await expect.poll(async () => (await save(page))?.actions.at(-1)?.id).toBe("tracks");
  await context.setOffline(false);
});
