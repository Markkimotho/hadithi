// One-time migration/export tool: writes the current Wisdom layouts as Tiled JSON.
// After this migration, the .json files are the authored sources of truth.
import { mkdir, writeFile } from "node:fs/promises";
import { layoutsFor } from "../site/world/layouts/index.js";
import tileset from "../site/art/wisdom/tiles.json" with { type: "json" };

const root = new URL("../site/maps/wisdom/", import.meta.url);
const tileGid = new Map(tileset.tiles.map((tile, index) => [tile.glyph, index + 1]));
const properties = (entries) => Object.entries(entries).filter(([, value]) => value != null).map(([name, value]) => ({
  name,
  type: typeof value === "number" ? "float" : typeof value === "boolean" ? "bool" : "string",
  value: typeof value === "string" || Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : value,
}));
const point = ([x, y]) => ({ x: (x + 0.5) * 32, y: (y + 0.5) * 32, width: 0, height: 0, point: true });

await mkdir(root, { recursive: true });
for (const [scene, layout] of Object.entries(layoutsFor("wisdom"))) {
  const width = layout.width, height = layout.height, objects = [];
  let id = 1;
  for (const [from, at] of Object.entries(layout.spawn)) objects.push({ id: id++, name: from, type: "spawn", ...point(at) });
  for (const spot of layout.spots) {
    const at = spot.at;
    objects.push({ id: id++, name: spot.id, type: "hotspot", ...point(at), properties: properties({ actions: spot.actions, label: spot.name }) });
  }
  for (const [action, cells] of Object.entries(layout.exits)) for (const at of cells)
    objects.push({ id: id++, name: action, type: "exit", ...point(at) });
  const packaged = (kind, list) => list.map((item) => ({
    id: id++, name: item.id ?? item.kind ?? kind, type: kind,
    ...point(item.at), width: (item.w ?? 1) * 32, height: (item.h ?? 1) * 32,
    properties: properties(Object.fromEntries(Object.entries(item).filter(([key]) => key !== "at"))),
  }));
  objects.push(...packaged("prop", layout.props), ...packaged("person", layout.people));
  for (const flow of layout.flows) objects.push({
    id: id++, name: "current", type: "flow", x: flow.rect[0] * 32, y: flow.rect[1] * 32,
    width: flow.rect[2] * 32, height: flow.rect[3] * 32, properties: properties({ force: flow.force }),
  });
  const map = {
    type: "map", version: "1.10", tiledversion: "1.10.2", orientation: "orthogonal", renderorder: "right-down",
    width, height, tilewidth: 32, tileheight: 32, infinite: false,
    layers: [
      { id: 1, name: "ground", type: "tilelayer", width, height, opacity: 1, visible: true,
        data: layout.grid.flatMap((row) => row.map((glyph) => tileGid.get(glyph) ?? tileGid.get(" "))),
        x: 0, y: 0 },
      { id: 2, name: "objects", type: "objectgroup", draworder: "topdown", opacity: 1, visible: true, objects },
    ],
    tilesets: [{ firstgid: 1, name: "WisdomTerrain", tilewidth: 32, tileheight: 32,
      tilecount: tileset.tiles.length, columns: tileset.columns,
      image: "../../art/wisdom/tiles.svg", imagewidth: tileset.columns * 32, imageheight: tileset.rows * 32,
      tiles: tileset.tiles.map((tile, index) => ({ id: index, properties: [{ name: "glyph", type: "string", value: tile.glyph }] })),
    }],
    properties: properties({ shares: layout.shares, menu: layout.menu, wind: layout.wind }),
  };
  await writeFile(new URL(`${scene}.json`, root), `${JSON.stringify(map, null, 2)}\n`);
}
console.log(`Exported ${Object.keys(layoutsFor("wisdom")).length} Wisdom maps to site/maps/wisdom/`);
