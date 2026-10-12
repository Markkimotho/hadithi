// From a map layout to a first-person level. Pure data, tested in Node.
//
// The same layout that drives physics and pathfinding decides what you see:
//   walls     cells a ray stops at: walls, roofs, forest, hedges, and props
//             big enough to be buildings or trunks (STRUCTURES)
//   floor     the ground texture of every cell, with marks on the ground
//             (DECALS) painted into it
//   things    everything else stands as a billboard on its cell: props one
//             per cell they cover, fences and rocks from the ground plan
// Beyond the edge of the map there are no walls: the road out of a scene runs
// on into the fog, the floor repeating its last row.
import { tileAt, blockedTiles } from "../layout.js";
import { STRUCTURES, DECALS, paintTale } from "./textures.js";
import { spriteFor } from "./sprites.js";

/** Ground-plan tiles a ray stops at. */
export const WALL_TILES = new Set(["#", "h", "T", "b", " "]);
/** Ground-plan tiles that block walking but stand as things, not walls. */
export const TILE_THINGS = { "=": "fence", o: "boulder" };
const INDOOR_FLOORS = new Set(["+", "s", "r"]);

const keyOf = (kind, tint) => (tint ? `${kind}|${tint}` : kind);

/**
 * A level for one layout.
 * @returns {{ width, height, walls: (string|null)[], floors: string[], indoor: boolean, things: object[], solid(x, y): boolean }}
 */
export function buildLevel(layout) {
  const { width, height } = layout;
  const walls = new Array(width * height).fill(null);
  const floors = new Array(width * height);
  const decals = new Map();
  const things = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const ch = layout.grid[y][x];
      if (WALL_TILES.has(ch)) walls[y * width + x] = ch;
      floors[y * width + x] = ch === "w" || !WALL_TILES.has(ch) ? ch : nearestFloor(layout, x, y);
      if (TILE_THINGS[ch]) things.push({ kind: TILE_THINGS[ch], x: x + 0.5, y: y + 0.5, cell: [x, y], ground: true });
    }
  for (const [index, p] of layout.props.entries()) {
    if (p.physics) continue; // loose props are bodies; the world places them each frame
    const cells = [];
    for (let dy = 0; dy < (p.h ?? 1); dy++) for (let dx = 0; dx < (p.w ?? 1); dx++) cells.push([p.at[0] + dx, p.at[1] + dy]);
    if (STRUCTURES[p.kind]) {
      for (const [x, y] of cells) if (x >= 0 && y >= 0 && x < width && y < height) walls[y * width + x] = keyOf(p.kind, p.tint);
    } else if (DECALS[p.kind]) {
      for (const [x, y] of cells) decals.set(y * width + x, p.kind);
    } else
      for (const [k, [x, y]] of cells.entries())
        things.push({ kind: p.kind, tint: p.tint, x: x + 0.5, y: y + 0.5, cell: [x, y], prop: index, part: k, item: p.item ?? p.kind, block: Boolean(p.block) });
  }
  for (const [i, kind] of decals) floors[i] = `${floors[i]}|${kind}`;
  for (let i = 0; i < floors.length; i++) if (!floors[i].includes("|")) floors[i] += "|";
  const open = floors.filter((_, i) => !walls[i]);
  const indoor = open.length > 0 && open.filter((f) => INDOOR_FLOORS.has(f[0])).length / open.length >= 0.5 && edgeWalled(layout);
  return {
    width,
    height,
    walls,
    floors,
    indoor,
    things,
    solid: (x, y) => x >= 0 && y >= 0 && x < width && y < height && walls[y * width + x] !== null,
    /** Floor key at any cell; off the map, the nearest edge cell's floor. */
    floorAt(x, y) {
      const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
      const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
      return floors[cy * width + cx];
    },
  };
}

/** A wall cell's floor is whatever walkable ground is nearest, for the strip at its foot. */
function nearestFloor(layout, x, y) {
  for (let r = 1; r < 4; r++)
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const ch = layout.grid[y + dy]?.[x + dx];
      if (ch && !WALL_TILES.has(ch)) return ch;
    }
  return ".";
}

/** Interiors are mostly boards, flagstones or rugs and closed in by walls. */
function edgeWalled(layout) {
  let walled = 0,
    edge = 0;
  for (let x = 0; x < layout.width; x++)
    for (const y of [0, layout.height - 1]) {
      edge++;
      if (layout.grid[y][x] === "#") walled++;
    }
  for (let y = 0; y < layout.height; y++)
    for (const x of [0, layout.width - 1]) {
      edge++;
      if (layout.grid[y][x] === "#") walled++;
    }
  return walled / edge >= 0.6;
}

/** People and loose props of a layout, as sprite keys. */
export function spriteKeys(layout, extra = []) {
  const keys = new Set(extra);
  for (const t of buildLevel(layout).things) keys.add(keyOf(t.kind, t.tint));
  for (const p of layout.props) if (p.physics) keys.add(keyOf(p.kind, p.tint));
  for (const p of layout.people) keys.add(keyOf(p.kind, p.tint));
  return keys;
}

/**
 * Paint everything a tale's maps need, once. `extra` adds sprite kinds that
 * are not in any map (the hero, companions who join later).
 */
export function worldArtFor(tale, layouts, extra = []) {
  const wallKeys = new Set(),
    floorKeys = new Set(),
    spriteSet = new Set(extra);
  for (const layout of layouts) {
    const level = buildLevel(layout);
    for (const w of level.walls) if (w) wallKeys.add(w);
    for (const f of level.floors) floorKeys.add(f);
    for (const k of spriteKeys(layout)) spriteSet.add(k);
  }
  const painted = paintTale(tale, {
    walls: [...wallKeys].map((k) => k.split("|")[0]),
    floors: [...floorKeys].map((k) => k.split("|")),
  });
  // Tinted structures (the kitchen hut) share their painter but keep their key.
  const walls = new Map([...wallKeys].map((k) => [k, painted.walls.get(k.split("|")[0])]));
  const floors = painted.floors; // keyed `${tile}|${decal}`, as the level's floors are
  const sprites = new Map([...spriteSet].map((k) => [k, spriteFor(tale, ...k.split("|"))]));
  return { tale, walls, floors, ceiling: painted.ceiling, skyline: painted.skyline, sprites };
}

export { tileAt, blockedTiles };
