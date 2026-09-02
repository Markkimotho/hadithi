import { chromium } from "@playwright/test";
import { walkthroughs, commandsOf } from "./test/walkthroughs.js";
import { episodeById } from "./site/stories.js";
import { defaultSeed, seedCode } from "./site/game.js";
const out = process.argv[2];
const route = process.argv[3] ?? "shared";
const w = walkthroughs.find(x => x.name.startsWith(route));
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on("pageerror", e => console.log("ERR", e.message));
await p.addInitScript((echoes) => { if (!sessionStorage.getItem("t")) { localStorage.clear(); sessionStorage.setItem("t","1"); } localStorage.setItem("hadithi.v1.settings", JSON.stringify({ motion: true, trials: false })); if (echoes) localStorage.setItem("hadithi.v1.echoes", JSON.stringify({ wisdom: echoes })); }, w.echoes ?? null);
await p.goto("http://localhost:4173/?nosw&worldtest&seed=" + seedCode(defaultSeed(episodeById("wisdom"))));
await p.locator('[data-start="wisdom"]').click();
await p.waitForSelector('.world-stage[data-ready="true"]');
const settle = async () => { for (let i=0;i<60;i++){ const s=await p.evaluate(()=>window.__hadithi.story()); if(!s.telling) return; if (s.beat==="chapter") await p.waitForTimeout(200); else await p.locator(".story-next").click({timeout: 3000}).catch(()=>{}); } };
let last = null;
for (const c of commandsOf(w)) {
  await settle();
  const scene = await p.evaluate(() => window.__hadithi.world()?.scene);
  if (scene !== last) { await p.waitForTimeout(500); await p.screenshot({ path: `${out}/tour-${route}-${scene}.png` }); last = scene; }
  const placed = c.id && await p.evaluate((x) => window.__hadithi.placed(x), c.id);
  if (c.type === "PUZZLE") await p.locator(`[data-puzzle="${c.id}"]`).click();
  else if (c.type === "SHIFT_THEME") { await p.keyboard.press("j"); await p.locator("#shift-theme").click(); await p.locator(`[data-theme="${c.id}"]`).click(); }
  else if (c.type === "DEDUCE") { await p.keyboard.press("k"); for (const id of c.ids) await p.locator(`[data-clue="${id}"]`).click(); await p.locator("#connect").click(); }
  else if (placed) await p.evaluate((x) => window.__hadithi.walkTo(x), c.id);
  else await p.locator(`[data-choice="${c.id}"]`).click({ timeout: 4000 }).catch(e => console.log("NOCLICK", c.id));
  await p.waitForTimeout(700);
}
await settle();
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/tour-${route}-ending.png` });
console.log("done", last);
await b.close();
