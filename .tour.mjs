import { chromium } from "@playwright/test";
import { walkthroughs, commandsOf } from "./test/walkthroughs.js";
import { episodeById } from "./site/stories.js";
import { defaultSeed, seedCode } from "./site/game.js";
const [out, tale, route] = process.argv.slice(2);
const w = walkthroughs.find(x => x.episode === tale && x.name.startsWith(route));
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on("pageerror", e => console.log("ERR", e.message)); p.on("console", m => m.type()==="error" && console.log("CERR", m.text()));
await p.addInitScript(([echoes, tale]) => { if (!sessionStorage.getItem("t")) { localStorage.clear(); sessionStorage.setItem("t","1"); } localStorage.setItem("hadithi.v1.settings", JSON.stringify({ motion: false, trials: false })); if (echoes) localStorage.setItem("hadithi.v1.echoes", JSON.stringify({ [tale]: echoes })); }, [w.echoes ?? null, tale]);
await p.goto(`http://localhost:4173/?nosw&worldtest&seed=${seedCode(defaultSeed(episodeById(tale)))}`);
await p.locator(`[data-start="${tale}"]`).click();
await p.waitForSelector('.world-stage[data-ready="true"]');
const settle = async () => { for (let i=0;i<80;i++){ const s=await p.evaluate(()=>window.__hadithi.story()); if(!s.telling) return; if (s.beat==="chapter") await p.waitForTimeout(150); else await p.locator(".story-next").click({timeout:3000}).catch(()=>{}); } };
const save = () => p.evaluate((t) => JSON.parse(localStorage.getItem(`hadithi.v1.save.${t}`)).actions.length, tale);
let last = null;
for (const c of commandsOf(w)) {
  await settle();
  const scene = await p.evaluate(() => window.__hadithi.world()?.scene);
  if (scene !== last) { await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${tale}-${scene}.png` }); last = scene; }
  const before = await save();
  const placed = c.id && await p.evaluate((x) => window.__hadithi.placed(x), c.id);
  if (c.type === "PUZZLE") await p.locator(`[data-puzzle="${c.id}"]`).click();
  else if (c.type === "SHIFT_THEME") { await p.keyboard.press("j"); await p.locator("#shift-theme").click(); await p.locator(`[data-theme="${c.id}"]`).click(); }
  else if (c.type === "DEDUCE") { await p.keyboard.press("k"); for (const id of c.ids) await p.locator(`[data-clue="${id}"]`).click(); await p.locator("#connect").click(); }
  else if (c.type === "COMBINE") { await p.keyboard.press("b"); await p.locator(`[data-recipe="${c.id}"]`).click(); }
  else if (placed) await p.evaluate((x) => window.__hadithi.walkTo(x), c.id);
  else await p.locator(`[data-choice="${c.id}"]`).click({ timeout: 4000 }).catch(e => console.log("NOCLICK", c.id));
  for (let i = 0; i < 60 && (await save()) === before; i++) await p.waitForTimeout(100);
  if ((await save()) === before) { console.log("STUCK on", JSON.stringify(c), "scene", scene); break; }
}
await settle();
console.log(tale, route, "ending:", await p.locator(".ending-page h1").textContent().catch(()=>null));
await b.close();
