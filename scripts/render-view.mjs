#!/usr/bin/env node
// Render first-person frames of a scene in Node, the same renderer the game
// uses, and write them as PNGs to artifacts/views/ (not committed). For
// reviewing art and light without a browser.
//
//   node scripts/render-view.mjs                       every scene of every tale, from its spawn
//   node scripts/render-view.mjs wisdom courtyard      one scene, four directions
//   node scripts/render-view.mjs wisdom courtyard night  with another light
import { mkdirSync, writeFileSync } from "node:fs";
import { layoutsFor } from "../site/world/layouts/index.js";
import { episodeById } from "../site/stories.js";
import { buildLevel, worldArtFor } from "../site/world/ray/scene.js";
import { createTarget, prepareLevel, renderFrame, vignette } from "../site/world/ray/render.js";
import { camera, lightFor } from "../site/world/ray/cast.js";
import { spawnFor } from "../site/world/layout.js";
import { sceneThings, sceneLights, facingFrom } from "../site/world/ray/things.js";
import { png } from "./png.mjs";

const [taleArg, sceneArg, lightArg] = process.argv.slice(2);
const W = 480,
  H = 270;
mkdirSync("artifacts/views", { recursive: true });
for (const tale of taleArg ? [taleArg] : ["wisdom", "tide", "orchestra", "olives"]) {
  const layouts = layoutsFor(tale);
  const ep = episodeById(tale);
  const art = worldArtFor(tale, Object.values(layouts));
  for (const [id, layout] of Object.entries(layouts)) {
    if (sceneArg && id !== sceneArg) continue;
    const level = buildLevel(layout);
    const prepared = prepareLevel(level, art);
    const [sx, sy] = spawnFor(layout, null);
    const light = lightFor(lightArg ?? ep.scenes[id]?.light ?? "day");
    const base = facingFrom(layout, [sx, sy]);
    const turns = sceneArg ? [0, 1, 2, 3] : [0];
    for (const q of turns) {
      const cam = camera(sx + 0.5, sy + 0.5, base + (q * Math.PI) / 2, W / H);
      const target = createTarget(W, H);
      const things = sceneThings(level, layout, art, { time: 1 });
      const stats = renderFrame(target, prepared, cam, { light, time: 1, things, lights: sceneLights(level, layout, light) });
      vignette(target);
      const file = `artifacts/views/${tale}-${id}${sceneArg ? `-${q}` : ""}${lightArg ? `-${lightArg}` : ""}.png`;
      writeFileSync(file, png({ w: W, h: H, data: target.data }));
      console.log(file, `${stats.wallColumns} wall columns, ${stats.things} things`);
    }
  }
}
