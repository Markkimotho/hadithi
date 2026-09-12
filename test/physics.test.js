import test from "node:test";
import assert from "node:assert/strict";
import * as planck from "planck";
import { parseLayout } from "../site/world/layout.js";
import { createPhysics, solidRects, STEP } from "../site/world/physics.js";
import { layoutsFor } from "../site/world/layouts/index.js";

const room = (extra = {}) =>
  parseLayout({
    ground: ["##########", "#........#", "#........#", "#........#", "##########"],
    spawn: { start: [1, 2] },
    ...extra,
  });
const run = (phys, steps, x = 0, y = 0, runFlag = false) => {
  phys.setIntent(x, y, runFlag);
  for (let i = 0; i < steps; i++) phys.step();
  return phys.player.getPosition();
};

test("greedy meshing covers every solid tile with few rectangles", () => {
  const l = room();
  const rects = solidRects(l);
  const covered = new Set(rects.flatMap((r) => Array.from({ length: r.w * r.h }, (_, i) => `${r.x + (i % r.w)},${r.y + Math.floor(i / r.w)}`)));
  for (let y = 0; y < l.height; y++)
    for (let x = 0; x < l.width; x++) assert.equal(covered.has(`${x},${y}`), l.grid[y][x] === "#", `${x},${y}`);
  assert.ok(rects.length <= 4);
  const market = layoutsFor("wisdom").market;
  assert.ok(solidRects(market).length < market.width * market.height * 0.2, "real maps mesh compactly");
});

test("the player walks, runs faster, and stops at walls", () => {
  const walk = createPhysics(planck, room(), [1, 2]);
  const a = run(walk, 30, 1, 0).x;
  const runner = createPhysics(planck, room(), [1, 2]);
  const b = run(runner, 30, 1, 0, true).x;
  assert.ok(b > a + 0.3, `running (${b}) beats walking (${a})`);
  const p = run(walk, 400, 1, 0);
  assert.ok(p.x < 9 - 0.29 && p.x > 8, `stopped by the east wall at ${p.x}`);
  run(walk, 60, 0, 0);
  assert.ok(Math.hypot(walk.player.getLinearVelocity().x, walk.player.getLinearVelocity().y) < 0.05, "comes to rest");
});

test("shallow water slows you down", () => {
  const dry = createPhysics(planck, room(), [1, 2]);
  const wet = createPhysics(planck, parseLayout({ ground: ["##########", "#~~~~~~~~#", "#~~~~~~~~#", "#~~~~~~~~#", "##########"] }), [1, 2]);
  assert.ok(run(dry, 40, 1, 0).x > run(wet, 40, 1, 0).x + 0.4);
});

test("crates get pushed; the same inputs give the same world", () => {
  const make = () => createPhysics(planck, room({ props: [{ kind: "crate", at: [4, 2], physics: "crate" }] }), [1, 2]);
  const a = make();
  const crate = a.props[0];
  const before = crate.body.getPosition().x;
  run(a, 150, 1, 0);
  assert.ok(crate.body.getPosition().x > before + 0.5, "the crate moved");
  const b = make();
  run(b, 150, 1, 0);
  assert.deepEqual(
    [a.player.getPosition().x, a.player.getPosition().y, crate.body.getPosition().x],
    [b.player.getPosition().x, b.player.getPosition().y, b.props[0].body.getPosition().x],
    "bit-identical replay in the same engine",
  );
});

test("a jar can be carried, set down gently, or thrown hard enough to crack", () => {
  const phys = createPhysics(planck, room({ props: [{ kind: "jar", at: [2, 2], physics: "jar" }] }), [1, 2]);
  const jar = phys.liftable();
  assert.equal(jar?.kind, "jar");
  phys.lift(jar);
  run(phys, 30, 1, 0);
  assert.ok(Math.abs(jar.body.getPosition().x - phys.player.getPosition().x) < 1e-9, "carried jar rides with you");
  phys.throw({ x: 1, y: 0 }, 0);
  run(phys, 60);
  assert.equal(jar.cracked, false, "set down gently");
  phys.lift(phys.liftable(2));
  run(phys, 10, 0, 0);
  phys.throw({ x: 1, y: 0 }, 1.4);
  run(phys, 120);
  assert.equal(jar.cracked, true, "thrown into the wall");
  assert.ok(phys.events.some((e) => e.type === "crack" && e.prop === jar));
  assert.ok(phys.events.some((e) => e.type === "land"));
});

test("wind and currents push bodies and stay bounded", () => {
  const still = createPhysics(planck, room(), [4, 2]);
  const windy = createPhysics(planck, room(), [4, 2]);
  windy.setWind(3, 0);
  run(still, 60);
  run(windy, 60);
  assert.ok(windy.player.getPosition().x > still.player.getPosition().x + 0.2);
  const river = createPhysics(planck, room({ flows: [{ rect: [1, 1, 8, 3], force: [0, 4] }] }), [4, 1]);
  const y = run(river, 120).y;
  assert.ok(y > 2.5 && y < 4, `the current carries you to the bank (${y})`);
  // The fixed step is small enough that nothing tunnels through a 1m wall.
  const fast = createPhysics(planck, room(), [1, 2]);
  fast.setWind(400, 0);
  run(fast, 240);
  assert.ok(fast.player.getPosition().x < 9, "no tunnelling");
  assert.equal(STEP, 1 / 60);
});

test("authored Wisdom map forces move the player through the ford and squall", () => {
  const maps = layoutsFor("wisdom");
  // Standing in the shallows, the current carries you downstream (east).
  const flowing = createPhysics(planck, maps.ford, [4, 8]);
  const still = createPhysics(planck, { ...maps.ford, flows: [] }, [4, 8]);
  for (let i = 0; i < 90; i++) { still.setIntent(0, 0); flowing.setIntent(0, 0); still.step(); flowing.step(); }
  assert.ok(flowing.player.getPosition().x > still.player.getPosition().x + 0.2, "ford current affects the idle player");
  const storm = createPhysics(planck, maps.squall, [9, 6]);
  const calm = createPhysics(planck, maps.squall, [9, 6]);
  calm.setWind(0, 0);
  for (let i = 0; i < 90; i++) { storm.setIntent(0, 0); calm.setIntent(0, 0); storm.step(); calm.step(); }
  assert.ok(storm.player.getPosition().x < calm.player.getPosition().x - 0.2, "squall's westward wind is physical");
});
