// Runtime map contract: Tiled JSON is parsed into this walkable ground plan.
//
// A layout is plain data after import so it can be checked in Node and used by
// the renderer and physics without coupling either to the Tiled file format:
//
//   {
//     ground: ["######", "#..,,#", ...],   one character per 1m tile
//     spawn: { start: [x, y], market: [x, y] },  keyed by the scene you came from
//     hotspots: { tracks: [x, y],           action id → the tile you stand next to
//                 potter: { at: [x, y], actions: ["secret", "listen"], name: "The potter" } },
//     exits: { market: [[x, y], ...] },     plain TRAVEL action id → tiles that leave
//     props: [{ kind: "pot", at: [x, y] }],
//     people: [{ id: "potter", at: [x, y] }],
//     menu: ["wait"],                       actions offered in the action bar instead
//     shares: "market",                     optional: same ground as another scene
//   }
//
// Scenes that share ground (the well is part of the market) swap hotspots
// without reloading the map or moving the player.
//
// Nothing here touches Phaser, so parsed map data drives the browser world,
// the reachability gates, and the physics tests.

/** Ground tiles: what you walk on, what blocks you, how it sounds underfoot. */
export const TILES = {
  ".": { name: "earth", solid: false, step: "earth" },
  ",": { name: "grass", solid: false, step: "grass" },
  '"': { name: "tallgrass", solid: false, step: "grass" },
  ":": { name: "path", solid: false, step: "earth" },
  _: { name: "sand", solid: false, step: "sand" },
  "~": { name: "shallows", solid: false, step: "water", slow: 0.55 },
  w: { name: "deep", solid: true, step: "water", water: true },
  "+": { name: "boards", solid: false, step: "wood" },
  s: { name: "flagstone", solid: false, step: "stone" },
  r: { name: "rug", solid: false, step: "cloth" },
  m: { name: "mud", solid: false, step: "mud", slow: 0.75 },
  "#": { name: "wall", solid: true, step: "stone" },
  "=": { name: "fence", solid: true, step: "wood" },
  o: { name: "rock", solid: true, step: "stone" },
  T: { name: "tree", solid: true, step: "earth" },
  b: { name: "bush", solid: true, step: "grass" },
  h: { name: "roof", solid: true, step: "stone" },
  " ": { name: "void", solid: true, step: "earth" },
};

export const SPAWN_FALLBACK = "start";

/** Parse and normalise a layout. Throws on malformed data. */
export function parseLayout(raw, label = "layout") {
  const rows = raw.ground;
  if (!Array.isArray(rows) || !rows.length) throw new Error(`${label}: no ground`);
  const width = Math.max(...rows.map((r) => [...r].length));
  const grid = rows.map((r) => [...r.padEnd(width, " ")]);
  for (const [y, row] of grid.entries())
    for (const [x, ch] of row.entries())
      if (!TILES[ch]) throw new Error(`${label}: unknown tile "${ch}" at ${x},${y}`);
  const spots = Object.entries(raw.hotspots ?? {}).map(([id, v]) =>
    Array.isArray(v) ? { id, at: v, actions: [id], name: null } : { id, at: v.at, actions: v.actions ?? [id], name: v.name ?? null },
  );
  return {
    ...raw,
    width,
    height: grid.length,
    grid,
    spawn: raw.spawn ?? {},
    spots,
    hotspots: Object.fromEntries(spots.map((sp) => [sp.id, sp.at])),
    exits: raw.exits ?? {},
    props: raw.props ?? [],
    people: raw.people ?? [],
    menu: raw.menu ?? [],
    flows: raw.flows ?? [],
  };
}

/** Convert a Tiled JSON map into the small runtime layout contract. */
export function parseTiledMap(map, label = "map") {
  const ground = map.layers?.find((layer) => layer.name === "ground" && layer.type === "tilelayer");
  const objects = map.layers?.find((layer) => layer.name === "objects" && layer.type === "objectgroup");
  if (!ground || !objects || !Array.isArray(ground.data)) throw new Error(`${label}: expected ground and objects layers`);
  if (ground.width !== map.width || ground.height !== map.height || ground.data.length !== map.width * map.height)
    throw new Error(`${label}: ground layer dimensions do not match the map`);
  const glyphs = new Map();
  for (const set of map.tilesets ?? []) for (const tile of set.tiles ?? []) {
    const value = tile.properties?.find((p) => p.name === "glyph")?.value;
    if (typeof value === "string") glyphs.set(set.firstgid + tile.id, value);
  }
  const rows = Array.from({ length: map.height }, (_, y) =>
    Array.from({ length: map.width }, (_, x) => {
      const gid = ground.data[y * map.width + x];
      const glyph = gid === 0 ? " " : glyphs.get(gid);
      if (!glyph || !TILES[glyph]) throw new Error(`${label}: unknown tile gid ${gid} at ${x},${y}`);
      return glyph;
    }).join(""),
  );
  const values = (list = []) => Object.fromEntries(list.map(({ name, value }) => {
    if (typeof value !== "string") return [name, value];
    try { return [name, JSON.parse(value)]; } catch { return [name, value]; }
  }));
  const tileAtObject = (object) => [Math.floor(object.x / map.tilewidth), Math.floor(object.y / map.tileheight)];
  const spawn = {}, hotspots = {}, exits = {}, props = [], people = [], flows = [];
  for (const object of objects.objects) {
    const data = values(object.properties);
    if (object.type === "spawn") spawn[object.name] = tileAtObject(object);
    if (object.type === "hotspot") hotspots[object.name] = { at: tileAtObject(object), actions: data.actions ?? [object.name], name: data.label ?? null };
    if (object.type === "exit") (exits[object.name] ??= []).push(tileAtObject(object));
    if (object.type === "prop" || object.type === "person") {
      const item = data.data ?? { ...data, at: tileAtObject(object) };
      if (!Array.isArray(item.at) || !item.kind) throw new Error(`${label}: ${object.type} ${object.name} has no kind or position`);
      (object.type === "prop" ? props : people).push(item);
    }
    if (object.type === "flow") flows.push({ rect: [object.x / map.tilewidth, object.y / map.tileheight, object.width / map.tilewidth, object.height / map.tileheight], force: data.force });
  }
  const mapProperties = values(map.properties);
  const menu = mapProperties.menu ?? [];
  return parseLayout({ ground: rows, spawn, hotspots, exits, props, people, flows, menu, wind: mapProperties.wind ?? [0, 0], format: "tiled", ...(mapProperties.shares ? { shares: mapProperties.shares } : {}) }, label);
}

export const tileAt = (layout, x, y) => TILES[layout.grid[y]?.[x] ?? " "];

/** Props with `block: true` (houses, wells, looms) and standing people stop walking. */
export function blockedTiles(layout) {
  const blocked = new Set();
  for (const p of layout.props)
    if (p.block)
      for (let dy = 0; dy < (p.h ?? 1); dy++)
        for (let dx = 0; dx < (p.w ?? 1); dx++) blocked.add(`${p.at[0] + dx},${p.at[1] + dy}`);
  // People standing on the ground block a tile; wanderers and the perched do not.
  for (const person of layout.people ?? []) if (!person.wander && !person.perch) blocked.add(`${person.at[0]},${person.at[1]}`);
  return blocked;
}

export function walkable(layout, x, y, blocked = blockedTiles(layout)) {
  if (x < 0 || y < 0 || x >= layout.width || y >= layout.height) return false;
  return !tileAt(layout, x, y).solid && !blocked.has(`${x},${y}`);
}

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Every tile reachable on foot from a start tile. */
export function reachable(layout, start) {
  const blocked = blockedTiles(layout);
  const seen = new Set();
  if (!walkable(layout, start[0], start[1], blocked)) return seen;
  const queue = [start];
  seen.add(`${start[0]},${start[1]}`);
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of N4) {
      const nx = x + dx,
        ny = y + dy,
        key = `${nx},${ny}`;
      if (!seen.has(key) && walkable(layout, nx, ny, blocked)) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}

/** A hotspot is usable if you can stand on it or on a tile beside it. */
export function standableNear(layout, [x, y], seen) {
  return [[0, 0], ...N4].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
}

/**
 * Grid A* with 8-way moves (no corner cutting). Returns tile centres from
 * start to goal, or null. Used for tap-to-move and for the test walker.
 */
export function findPath(layout, start, goal, blocked = blockedTiles(layout)) {
  const key = (x, y) => y * layout.width + x;
  const ok = (x, y) => walkable(layout, x, y, blocked);
  const goals = ok(goal[0], goal[1]) ? [goal] : N4
      .map(([dx, dy]) => [goal[0] + dx, goal[1] + dy])
      .filter(([x, y]) => ok(x, y));
  // Search all usable sides of a solid hotspot. The closest side by straight
  // line distance may be sealed off by another wall or a movable crate.
  if (!goals.length || !ok(start[0], start[1])) return null;
  const goalKeys = new Set(goals.map(([x, y]) => key(x, y)));
  const open = new Map([[key(...start), { x: start[0], y: start[1], g: 0, f: 0, parent: null }]]);
  const closed = new Set();
  const h = (x, y) => Math.min(...goals.map(([gx, gy]) => Math.hypot(x - gx, y - gy)));
  while (open.size) {
    let best = null;
    for (const node of open.values()) if (!best || node.f < best.f) best = node;
    open.delete(key(best.x, best.y));
    if (goalKeys.has(key(best.x, best.y))) {
      const path = [];
      for (let n = best; n; n = n.parent) path.unshift([n.x, n.y]);
      return path;
    }
    closed.add(key(best.x, best.y));
    for (const [dx, dy] of [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = best.x + dx,
        ny = best.y + dy;
      if (!ok(nx, ny) || closed.has(key(nx, ny))) continue;
      if (dx && dy && (!ok(best.x + dx, best.y) || !ok(best.x, best.y + dy))) continue;
      // Slow ground (shallows, mud) costs more, so paths go round it when they can.
      const g = best.g + (dx && dy ? Math.SQRT2 : 1) / (tileAt(layout, nx, ny).slow ?? 1);
      const existing = open.get(key(nx, ny));
      if (!existing || g < existing.g) open.set(key(nx, ny), { x: nx, y: ny, g, f: g + h(nx, ny), parent: best });
    }
  }
  return null;
}

/** Which scene a spawn point is for, given where the player came from. */
export function spawnFor(layout, from) {
  return layout.spawn[from] ?? layout.spawn[SPAWN_FALLBACK] ?? Object.values(layout.spawn)[0] ?? [1, 1];
}

/**
 * Check a layout against its story scene. Every action must have a place
 * (hotspot, exit, or the action bar), every place must be reachable on foot
 * from every spawn, and exits must be plain travel.
 */
export function layoutErrors(layout, scene, sceneId) {
  const errors = [];
  const where = (t) => `${sceneId}: ${t}`;
  const actions = new Map(scene.actions.map((a) => [a.id, a]));
  const placed = new Map();
  const count = (id) => placed.set(id, (placed.get(id) ?? 0) + 1);
  for (const sp of layout.spots) sp.actions.forEach(count);
  Object.keys(layout.exits).forEach(count);
  layout.menu.forEach(count);
  for (const id of actions.keys()) {
    const n = placed.get(id) ?? 0;
    if (n === 0) errors.push(where(`action ${id} has no hotspot, exit, or menu place`));
    if (n > 1) errors.push(where(`action ${id} is placed twice`));
  }
  for (const id of placed.keys()) if (!actions.has(id)) errors.push(where(`layout names unknown action ${id}`));
  for (const id of Object.keys(layout.exits)) {
    const a = actions.get(id);
    if (a && (a.type !== "TRAVEL" || a.check || !a.effects?.to)) errors.push(where(`exit ${id} must be a plain travel action`));
  }
  const spawns = Object.entries(layout.spawn);
  if (!spawns.length) errors.push(where("no spawn point"));
  for (const [from, at] of spawns) {
    if (!walkable(layout, at[0], at[1])) {
      errors.push(where(`spawn ${from} is not walkable`));
      continue;
    }
    const seen = reachable(layout, at);
    for (const [id, tile] of Object.entries(layout.hotspots))
      if (!standableNear(layout, tile, seen)) errors.push(where(`hotspot ${id} cannot be reached from spawn ${from}`));
    for (const [id, tiles] of Object.entries(layout.exits))
      if (!tiles.some(([x, y]) => seen.has(`${x},${y}`))) errors.push(where(`exit ${id} cannot be reached from spawn ${from}`));
  }
  for (const [id, tiles] of Object.entries(layout.exits))
    for (const [x, y] of tiles)
      if (!walkable(layout, x, y)) errors.push(where(`exit ${id} tile ${x},${y} is not walkable`));
  for (const p of [...layout.props, ...layout.people])
    if (!p.at || p.at[0] < 0 || p.at[1] < 0 || p.at[0] >= layout.width || p.at[1] >= layout.height)
      errors.push(where(`${p.kind ?? p.id} is outside the map`));
  return errors;
}
