import test from "node:test";
import assert from "node:assert/strict";
import { episodeById } from "../site/stories.js";
import { parseLayout, layoutErrors, findPath, reachable, spawnFor, TILES } from "../site/world/layout.js";
import { layoutsFor, talesWithLayouts } from "../site/world/layouts/index.js";

const tiny = () =>
  parseLayout({
    ground: ["#####", "#..~#", "#.#.#", "#...#", "#####"],
    spawn: { start: [1, 1] },
    hotspots: { look: [3, 3] },
    exits: {},
  });

test("parsing rejects unknown tiles and normalises hotspots", () => {
  assert.throws(() => parseLayout({ ground: ["#?#"] }), /unknown tile "\?"/);
  const l = parseLayout({ ground: [".."], hotspots: { a: [0, 0], p: { at: [1, 0], actions: ["x", "y"] } } });
  assert.deepEqual(l.spots.map((s) => s.actions), [["a"], ["x", "y"]]);
});

test("pathfinding goes round walls, avoids cutting corners, and prefers dry ground", () => {
  const l = tiny();
  const path = findPath(l, [1, 1], [3, 3]);
  assert.deepEqual(path[0], [1, 1]);
  assert.deepEqual(path.at(-1), [3, 3]);
  for (const [x, y] of path) assert.equal(TILES[l.grid[y][x]].solid, false);
  const sealed = parseLayout({ ground: ["#####", "#.###", "#####"] });
  assert.equal(findPath(sealed, [1, 1], [3, 1]), null, "a target walled in on every side");
  const wet = parseLayout({ ground: ["....", ".~~.", "...."] });
  assert.ok(!findPath(wet, [0, 1], [3, 1]).some(([x, y]) => wet.grid[y][x] === "~"), "goes round shallows");
});

test("a solid target resolves to the nearest standable neighbour", () => {
  const l = parseLayout({ ground: ["...", ".#.", "..."] });
  const path = findPath(l, [0, 0], [1, 1]);
  assert.ok(path && path.length >= 1);
  assert.notDeepEqual(path.at(-1), [1, 1]);
});

test("a solid target can be approached when its closest side is sealed off", () => {
  const l = parseLayout({ ground: ["#########", "#.......#", "#..###..#", "#..#.#..#", "#..###..#", "#.......#", "#########"] });
  const path = findPath(l, [1, 3], [5, 3]);
  assert.ok(path, "finds the reachable east side, past the sealed west side");
  assert.deepEqual(path.at(-1), [6, 3]);
});

test("non-travel story choices cannot become automatic exits", () => {
  const l = parseLayout({ ground: ["...", "..."], spawn: { start: [0, 0] }, exits: { choice: [[2, 1]] } });
  const scene = { actions: [{ id: "choice", type: "CHOOSE", effects: { to: "next" } }] };
  assert.match(layoutErrors(l, scene, "room").join("\n"), /exit choice must be a plain travel action/);
});

test("layout checks catch unplaced actions, walled-off hotspots, and bad exits", () => {
  const scene = {
    actions: [
      { id: "look", type: "INSPECT" },
      { id: "talk", type: "TALK" },
      { id: "leap", type: "TRAVEL", effects: { to: "x" }, check: {} },
    ],
  };
  const l = parseLayout({
    ground: ["#####", "#.#.#", "#####"],
    spawn: { start: [1, 1] },
    hotspots: { look: [3, 1], ghost: [1, 1] },
    exits: { leap: [[1, 1]] },
  });
  const errors = layoutErrors(l, scene, "s").join("\n");
  assert.match(errors, /action talk has no hotspot/);
  assert.match(errors, /layout names unknown action ghost/);
  assert.match(errors, /hotspot look cannot be reached/);
  assert.match(errors, /exit leap must be a plain travel action/);
});

test("shared ground inherits the base map and keeps its own places", () => {
  const w = layoutsFor("wisdom");
  assert.deepEqual(w.well.grid, w.market.grid);
  assert.deepEqual(w.well.spots.map((s) => s.id), ["fill"]);
  assert.deepEqual(spawnFor(w.well, "market"), spawnFor(w.market, "start"));
});

test("all Wisdom scenes load authored Tiled maps with river and squall forces", () => {
  const maps = layoutsFor("wisdom");
  assert.ok(Object.values(maps).every((layout) => layout.format === "tiled"));
  assert.ok(maps.river.flows.length && maps.ford.flows.length, "water maps carry current fields");
  assert.ok(maps.squall.wind[0] < 0, "the squall map declares a westward gust");
  assert.notDeepEqual(maps.trail.grid, maps.grove.grid, "forest scenes have distinct authored ground plans");
});

for (const taleId of talesWithLayouts()) {
  const ep = episodeById(taleId);
  const layouts = layoutsFor(taleId);
  test(`${taleId}: every layout fits its scene and every place is reachable`, () => {
    if (taleId === "wisdom") assert.deepEqual(Object.keys(layouts).sort(), Object.keys(ep.scenes).sort(), "the Wisdom vertical slice has a world map for every scene");
    for (const [sceneId, layout] of Object.entries(layouts)) {
      assert.ok(ep.scenes[sceneId], `${sceneId} is a real scene`);
      const rows = layout.shares ? [] : layout.ground;
      assert.ok(rows.every((r) => [...r].length === layout.width), `${sceneId}: rows are the same width`);
      assert.deepEqual(layoutErrors(layout, ep.scenes[sceneId], sceneId), []);
    }
  });
  test(`${taleId}: spawns exist for every way into a laid-out scene`, () => {
    for (const [sceneId, layout] of Object.entries(layouts)) {
      const sources = Object.entries(ep.scenes)
        .filter(([id, s]) => id !== sceneId && layouts[id] && !layouts[id].shares && !layout.shares)
        .filter(([, s]) => s.actions.some((a) => a.effects?.to === sceneId))
        .map(([id]) => id);
      for (const from of sources) assert.ok(layout.spawn[from], `${sceneId} has a spawn for arrivals from ${from}`);
      const start = spawnFor(layout, "start");
      assert.ok(reachable(layout, start).size > 20, `${sceneId}: room to walk`);
    }
  });
}
