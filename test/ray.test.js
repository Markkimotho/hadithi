// The first-person world's geometry, light and renderer, run in Node.
import test from "node:test";
import assert from "node:assert/strict";
import { parseLayout } from "../site/world/layout.js";
import { layoutsFor } from "../site/world/layouts/index.js";
import {
  camera,
  castRay,
  castColumns,
  project,
  floorDistance,
  aimAt,
  turnToward,
  lightAt,
  torchBeam,
  fogAmount,
  dayDiffuse,
  lightFor,
  LIGHTS,
  focal,
  WALL_H,
} from "../site/world/ray/cast.js";
import { buildLevel, worldArtFor, WALL_TILES } from "../site/world/ray/scene.js";
import { createTarget, prepareLevel, renderFrame, blit } from "../site/world/ray/render.js";
import { sceneLights, facingFrom, sceneThings } from "../site/world/ray/things.js";
import { spriteFor, PEOPLE, PROPS, bounds } from "../site/world/ray/sprites.js";
import { texture, pack } from "../site/world/ray/paint.js";
import { lightModel } from "../site/world/lightmodel.js";

const room = (extra = {}) =>
  parseLayout({
    ground: ["##########", "#........#", "#........#", "#........#", "##########"],
    spawn: { start: [1, 2] },
    ...extra,
  });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test("a ray stops at the first wall with the perpendicular distance and the face it hit", () => {
  const level = buildLevel(room());
  // From the middle of tile (1,2) looking east: the east wall's inner face is at x = 9.
  const east = castRay(level.solid, 1.5, 2.5, 1, 0);
  assert.equal(east.mapX, 9);
  assert.ok(near(east.dist, 7.5));
  assert.equal(east.side, 0);
  // Looking north: the wall row y = 0 has its face at y = 1.
  const north = castRay(level.solid, 1.5, 2.5, 0, -1);
  assert.equal(north.mapY, 0);
  assert.ok(near(north.dist, 1.5));
  assert.equal(north.side, 1);
  // wallX is where along the face the ray struck, 0..1.
  const slant = castRay(level.solid, 1.5, 2.5, 1, 0.1);
  assert.ok(slant.wallX > 0 && slant.wallX < 1);
});

test("rays leaving an open map return nothing, so roads out run on into the fog", () => {
  const open = buildLevel(parseLayout({ ground: ["....", "....", "...."], spawn: { start: [1, 1] } }));
  assert.equal(castRay(open.solid, 1.5, 1.5, 1, 0), null);
  assert.equal(open.floorAt(99, -5), open.floorAt(3, 0), "off the map, the floor repeats the nearest edge cell");
});

test("column distances are perpendicular: a flat wall is the same distance across the screen", () => {
  const level = buildLevel(room());
  const cam = camera(5, 2.5, 0, 16 / 9);
  const cols = castColumns(level.solid, cam, 64);
  for (let x = 20; x < 44; x++) assert.ok(near(cols.dist[x], 4, 1e-3), `column ${x} sees the east wall 4 m away, not a fisheye curve`);
});

test("projection puts a point dead ahead at the centre and behind the eye nowhere", () => {
  const cam = camera(2, 2, 0, 16 / 9);
  const ahead = project(cam, 5, 2, 1.5, 320, 180, { eye: 1.5 });
  assert.ok(near(ahead.x, 160) && near(ahead.y, 90) && near(ahead.depth, 3));
  assert.equal(project(cam, 0, 2, 0, 320, 180), null);
  // Lower points land lower on screen; nearer points are bigger.
  const foot = project(cam, 5, 2, 0, 320, 180, { eye: 1.5 });
  assert.ok(foot.y > ahead.y);
  assert.ok(project(cam, 3, 2, 0, 320, 180).scale > foot.scale);
  // A floor row and the projection of the floor agree.
  assert.ok(near(floorDistance(Math.floor(foot.y), cam, 320, 90, 1.5), 3, 0.06));
});

test("portrait screens narrow the field of view so people keep their shape", () => {
  assert.ok(camera(0, 0, 0, 9 / 19.5).plane < camera(0, 0, 0, 16 / 9).plane);
  assert.ok(camera(0, 0, 0, 9 / 19.5).plane >= 0.36);
});

test("the crosshair picks the nearest thing in reach and never one behind a wall", () => {
  const level = buildLevel(room({ ground: ["##########", "#...#....#", "#...#....#", "#........#", "##########"] }));
  const cam = camera(1.5, 1.5, 0, 16 / 9);
  const things = [
    { id: "far", x: 3.5, y: 1.5, h: 1.7, w: 0.8 },
    { id: "near", x: 2.5, y: 1.5, h: 1.7, w: 0.8 },
    { id: "walled", x: 5.5, y: 1.5, h: 1.7, w: 0.8 },
  ];
  assert.equal(aimAt(cam, things, level.solid, { reach: 6, eye: 1.5 }).target.id, "near");
  assert.equal(aimAt(cam, things.slice(2), level.solid, { reach: 6, eye: 1.5 }), null, "the wall at x=4 hides it");
  assert.equal(aimAt(cam, things.slice(0, 1), level.solid, { reach: 1.5, eye: 1.5 }), null, "out of reach");
  assert.equal(aimAt(camera(1.5, 1.5, Math.PI, 16 / 9), things, level.solid, { reach: 6, eye: 1.5 }), null, "behind you");
});

test("turning goes the short way round and never overshoots", () => {
  assert.ok(near(turnToward(0, 0.1, 1), 0.1));
  assert.ok(near(turnToward(0, 1, 0.25), 0.25));
  assert.ok(turnToward(3, -3, 0.1) > 3, "from just under pi to just over -pi turns forward, through pi");
});

test("light: daylight fades gently, the torch is a cone, fog grows with distance", () => {
  assert.ok(dayDiffuse(1) > dayDiffuse(20));
  assert.ok(dayDiffuse(5, 1) < dayDiffuse(5, 0), "north and south faces are darker");
  assert.ok(torchBeam(2, 0) > torchBeam(2, 0.9), "brightest in the middle of the screen");
  assert.ok(torchBeam(1, 0) > torchBeam(6, 0), "and falls off with distance");
  assert.ok(fogAmount(1, 0.05) < fogAmount(10, 0.05));
  assert.equal(fogAmount(Infinity, 0.05), 1);
  const night = lightFor("night"),
    day = lightFor("day");
  assert.ok(lightAt(day, 3, 0, 0)[0] > lightAt(night, 3, 0, 0.9)[0]);
  assert.ok(lightAt(night, 2, 0, 0)[0] > lightAt(night, 2, 0, 0.9)[0] * 1.5, "at night the torch carries the scene");
  assert.equal(lightFor("nonsense"), LIGHTS.day);
  for (const [name, m] of Object.entries(LIGHTS)) assert.ok(m.sky.length === 2 && m.fog.length === 3 && m.density > 0, name);
});

test("weather changes the light: storms darken, mist thickens the fog", () => {
  const plain = lightModel({ light: "day", weather: "none" });
  const storm = lightModel({ light: "day", weather: "storm" });
  const mist = lightModel({ light: "day", weather: "mist" });
  assert.ok(storm.day < plain.day && storm.density > plain.density);
  assert.ok(mist.density > plain.density * 1.5);
  // The sky closes in toward the fog, so mist is not a blue sky over grey ground.
  const gap = (m) => Math.abs(m.sky[1][0] - m.fog[0]) + Math.abs(m.sky[1][2] - m.fog[2]);
  assert.ok(gap(mist) < gap(plain));
  assert.equal(lightFor("day").day, 1, "the shared model is never mutated");
});

test("a level: walls from the ground plan and from buildings, things on their cells, marks in the floor", () => {
  const layout = room({
    props: [
      { kind: "hut", w: 2, h: 1, block: true, at: [2, 1] },
      { kind: "jar", at: [5, 2] },
      { kind: "leaves", at: [6, 2] },
      { kind: "jar", physics: "jar", at: [7, 2] },
      { kind: "counter", w: 3, at: [2, 3] },
    ],
  });
  const level = buildLevel(layout);
  assert.equal(level.walls[1 * level.width + 2], "hut");
  assert.equal(level.walls[1 * level.width + 3], "hut");
  assert.ok(level.solid(0, 0) && level.solid(2, 1) && !level.solid(5, 2));
  assert.equal(level.floors[2 * level.width + 6], ".|leaves", "leaves are painted into the ground");
  assert.deepEqual(level.things.filter((t) => t.kind === "jar").map((t) => t.cell), [[5, 2]], "loose bodies are placed by physics, not here");
  assert.equal(level.things.filter((t) => t.kind === "counter").length, 3, "one billboard per cell a long prop covers");
  assert.equal(level.indoor, false);
  const hall = buildLevel(parseLayout({ ground: ["#####", "#+++#", "#+++#", "#####"], spawn: { start: [1, 1] } }));
  assert.equal(hall.indoor, true, "boards inside walls are a room with a ceiling");
});

test("every map of every tale builds a level whose spawn stands in open air", () => {
  for (const tale of ["wisdom", "tide", "orchestra", "olives"])
    for (const [id, layout] of Object.entries(layoutsFor(tale))) {
      const level = buildLevel(layout);
      for (const [from, [x, y]] of Object.entries(layout.spawn)) assert.ok(!level.solid(x, y), `${tale}/${id}: spawn ${from} is inside a wall`);
      for (const sp of layout.spots) assert.ok(sp.at[0] >= 0 && sp.at[1] >= 0, `${tale}/${id}: ${sp.id}`);
      for (const ch of WALL_TILES) assert.ok(typeof ch === "string");
    }
});

test("arrival faces the things to do, not the wall behind you", () => {
  const layout = room({ hotspots: { look: [7, 2] } });
  assert.ok(near(facingFrom(layout, [1, 2]), 0), "east, toward the only hotspot");
  const courtyard = layoutsFor("wisdom").courtyard;
  const angle = facingFrom(courtyard, courtyard.spawn.start);
  const level = buildLevel(courtyard);
  const [sx, sy] = courtyard.spawn.start;
  const hit = castRay(level.solid, sx + 0.5, sy + 0.5, Math.cos(angle), Math.sin(angle));
  assert.ok(!hit || hit.dist > 2, "the first view is not a wall in the face");
});

test("fires and lanterns light the dark, not the day", () => {
  const layout = room({ props: [{ kind: "fire", block: true, at: [4, 2] }, { kind: "lantern", at: [6, 2] }] });
  const level = buildLevel(layout);
  assert.equal(sceneLights(level, layout, lightFor("day")).length, 0);
  const night = sceneLights(level, layout, lightFor("night"));
  assert.equal(night.length, 2);
  assert.ok(night[0].power > night[1].power, "the fire is the strongest light");
});

/** Render one frame of a layout from a spot, looking along an angle. */
function frame(layout, at, angle, light = "day", { things = [], tale = "wisdom", w = 96, h = 54 } = {}) {
  const level = buildLevel(layout);
  const art = worldArtFor(tale, [layout], things.map((t) => t.kind));
  const target = createTarget(w, h);
  const cam = camera(at[0], at[1], angle, w / h);
  const instances = [...sceneThings(level, layout, art), ...things.map((t) => ({ ...t, sprite: art.sprites.get(t.kind) }))];
  const stats = renderFrame(target, prepareLevel(level, art), cam, { light: lightFor(light), eye: 1.5, things: instances, lights: sceneLights(level, layout, lightFor(light)) });
  return { target, stats, cam };
}
const lum = (c) => (c & 255) * 0.3 + ((c >>> 8) & 255) * 0.59 + ((c >>> 16) & 255) * 0.11;
const avg = (t, x0, y0, x1, y1) => {
  let s = 0,
    n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++, n++) s += lum(t.data[y * t.w + x]);
  return s / n;
};

test("a rendered frame: every pixel opaque, wall in the middle, sky above it, floor below", () => {
  const { target, stats } = frame(room(), [1.5, 2.5], 0);
  assert.ok(target.data.every((c) => c >>> 24 === 255), "no holes in the frame");
  assert.equal(stats.wallColumns, 96);
  // East wall 7.5 m away and 2.5 m tall: the eye at 1.5 sees it from just above to just below the middle.
  const span = (WALL_H * focal(camera(0, 0, 0, 96 / 54), 96)) / 7.5;
  assert.ok(span > 8 && span < 40);
  // Above the wall is open sky (this room has no roof); the floor fills the bottom rows.
  const skyRow = target.data[2 * 96 + 48],
    floorRow = target.data[53 * 96 + 48];
  assert.notEqual(skyRow, floorRow);
  // The renderer is deterministic: the same frame twice is the same pixels.
  assert.deepEqual(frame(room(), [1.5, 2.5], 0).target.data, target.data);
});

test("night is dark at the edges and lit where the torch points", () => {
  const day = frame(room(), [1.5, 2.5], 0, "day").target;
  const night = frame(room(), [1.5, 2.5], 0, "night").target;
  assert.ok(avg(day, 0, 30, 96, 54) > avg(night, 0, 30, 96, 54) * 2, "night is darker");
  assert.ok(avg(night, 40, 40, 56, 54) > avg(night, 0, 40, 12, 54), "the torch cone lights the middle");
});

test("a fire lights the ground around it at night", () => {
  const lit = room({ props: [{ kind: "fire", block: true, at: [5, 2] }] });
  const dark = room({ props: [{ kind: "stool", block: true, at: [5, 2] }] });
  // Look sideways so the torch cone falls elsewhere; compare the floor near the fire.
  const a = frame(lit, [3.5, 3.6], -0.3, "night").target;
  const b = frame(dark, [3.5, 3.6], -0.3, "night").target;
  assert.ok(avg(a, 0, 36, 96, 54) > avg(b, 0, 36, 96, 54) * 1.2);
});

test("things stand on the floor and walls hide what is behind them", () => {
  const layout = room({ ground: ["##########", "#........#", "#........#", "#........#", "##########"] });
  const hen = [{ kind: "potter", x: 4.5, y: 2.5, z: 0, frame: 0 }];
  const { target, stats } = frame(layout, [1.5, 2.5], 0, "day", { things: hen });
  const empty = frame(layout, [1.5, 2.5], 0, "day").target;
  assert.ok(stats.things >= 1);
  let changed = 0;
  for (let i = 0; i < target.data.length; i++) if (target.data[i] !== empty.data[i]) changed++;
  assert.ok(changed > 40, `the potter is drawn (${changed} pixels)`);
  // Behind a wall, it is not.
  const walled = room({ ground: ["##########", "#..#.....#", "#..#.....#", "#..#.....#", "##########"] });
  const hidden = frame(walled, [1.5, 2.5], 0, "day", { things: hen }).stats;
  assert.equal(hidden.things, 0);
});

test("blit scales a texture onto the frame and skips its clear pixels", () => {
  const t = texture(2, 2);
  t.data[0] = pack(255, 0, 0);
  const target = createTarget(8, 8);
  blit(target, t, 0, 0, 4, 4);
  assert.equal(target.data[0], pack(255, 0, 0));
  assert.equal(target.data[3 * 8 + 3], 0, "the clear quarter stays clear");
});

test("people stand about 1.7 m, children smaller, animals smaller still", () => {
  const tall = (kind) => {
    const s = spriteFor("olives", kind);
    return (s.h * bounds(s.tex).height) / s.tex.h;
  };
  assert.ok(Math.abs(tall("merchant") - 1.72) < 0.05);
  assert.ok(tall("child") < tall("merchant") * 0.75);
  assert.ok(tall("streetcat") < 0.6);
  for (const kind of Object.keys(PEOPLE)) assert.equal(spriteFor("wisdom", kind).frames.length, 4, `${kind} walks`);
  for (const [kind, spec] of Object.entries(PROPS)) assert.ok(spec.paint, kind);
});

test("no scene opens on a wall at arm's length, from any spawn (regression: trail from the ridge)", () => {
  for (const tale of ["wisdom", "tide", "orchestra", "olives"])
    for (const [id, layout] of Object.entries(layoutsFor(tale))) {
      const level = buildLevel(layout);
      for (const [from, [sx, sy]] of Object.entries(layout.spawn)) {
        const a = facingFrom(layout, [sx, sy], level.solid);
        const hit = castRay(level.solid, sx + 0.5, sy + 0.5, Math.cos(a), Math.sin(a), 10);
        assert.ok(!hit || hit.dist >= 2, `${tale}/${id} from ${from}: wall ${hit?.dist.toFixed(2)} m ahead`);
      }
    }
});

test("a thing underfoot is not drawn over the whole view (regression: the ford's stones)", () => {
  const layout = room();
  const stone = [{ kind: "potter", x: 3.6, y: 2.5, z: 0, frame: 0 }];
  const { target, stats } = frame(layout, [3.5, 2.5], 0, "day", { things: stone });
  assert.equal(stats.things, 0, "0.1 m in front of the eye is inside it");
  const empty = frame(layout, [3.5, 2.5], 0, "day").target;
  assert.deepEqual(target.data, empty.data);
});
