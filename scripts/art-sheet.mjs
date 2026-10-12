#!/usr/bin/env node
// Paint every texture and sprite a tale uses onto one contact sheet, so the
// procedural art can be reviewed by eye. Writes artifacts/art/<tale>.png
// (artifacts/ is not committed).
//
//   node scripts/art-sheet.mjs            all four tales
//   node scripts/art-sheet.mjs wisdom     one tale
import { mkdirSync, writeFileSync } from "node:fs";
import { png } from "./png.mjs";
import { layoutsFor } from "../site/world/layouts/index.js";
import { worldArtFor } from "../site/world/ray/scene.js";
import { texture } from "../site/world/ray/paint.js";

/** Lay textures out in rows, scaled to `cell` pixels, on a checker so alpha shows. */
function sheet(items, cell = 128, columns = 10) {
  const rows = Math.ceil(items.length / columns);
  const out = texture(columns * cell, rows * cell);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) out.data[y * out.w + x] = ((x >> 3) + (y >> 3)) % 2 ? 0xff3a3a3a : 0xff2e2e2e;
  items.forEach((t, i) => {
    const ox = (i % columns) * cell,
      oy = Math.floor(i / columns) * cell;
    const s = Math.min(cell / t.w, cell / t.h);
    for (let y = 0; y < cell; y++)
      for (let x = 0; x < cell; x++) {
        const sx = Math.floor(x / s),
          sy = Math.floor(y / s);
        if (sx >= t.w || sy >= t.h) continue;
        const c = t.data[sy * t.w + sx];
        if (c >>> 24 > 127) out.data[(oy + y) * out.w + ox + x] = c | 0xff000000;
      }
  });
  return out;
}

const tales = process.argv.slice(2).length ? process.argv.slice(2) : ["wisdom", "tide", "orchestra", "olives"];
mkdirSync("artifacts/art", { recursive: true });
for (const tale of tales) {
  const art = worldArtFor(tale, Object.values(layoutsFor(tale)));
  const items = [...art.walls.values(), ...art.floors.values(), art.ceiling, ...[...art.sprites.values()].map((s) => s.tex)];
  writeFileSync(`artifacts/art/${tale}.png`, png(sheet(items)));
  writeFileSync(`artifacts/art/${tale}-sky.png`, png(art.skyline));
  console.log(`artifacts/art/${tale}.png: ${art.walls.size} walls, ${art.floors.size} floors, ${art.sprites.size} sprites`);
}
