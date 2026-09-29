import test from "node:test";
import assert from "node:assert/strict";
import { timingParams, passChance, erfinv, createTiming, schedule, simulatePlayer, paramsFor, SHAPES } from "../site/world/trials/core.js";

test("pass chance and erfinv are correct", () => {
  assert.equal(passChance(1, 3, 2), 1);
  assert.equal(passChance(0, 3, 2), 0);
  assert.ok(Math.abs(passChance(0.5, 3, 2) - 0.5) < 1e-12);
  for (const x of [-0.9, -0.3, 0, 0.42, 0.9, 0.995]) {
    const y = erfinv(x);
    // erf(y) by series, to check the inverse
    let erf = 0;
    for (let n = 0; n < 60; n++) erf += ((-1) ** n * y ** (2 * n + 1)) / (fact(n) * (2 * n + 1));
    erf *= 2 / Math.sqrt(Math.PI);
    assert.ok(Math.abs(erf - x) < 1e-5, `erf(erfinv(${x}))`);
  }
});
const fact = (n) => (n < 2 ? 1 : n * fact(n - 1));

test("better odds always mean a wider window", () => {
  for (const shape of Object.values(SHAPES)) {
    let last = 0;
    for (let c = 0.05; c <= 0.95; c += 0.05) {
      const p = timingParams(c, shape);
      assert.ok(p.window >= last, `monotonic at ${c}`);
      assert.ok(Math.abs(passChance(p.perMoment, p.moments, p.need) - c) < 1e-6);
      last = p.window;
    }
  }
});

test("a trial is the same every time for the same seed, and uneven within itself", () => {
  const p = paramsFor("leap", { chance: 0.6 });
  assert.deepEqual(schedule(p, "s1"), schedule(p, "s1"));
  assert.notDeepEqual(schedule(p, "s1"), schedule(p, "s2"));
  const gaps = schedule(p, "s1").map((t, i, a) => (i ? t - a[i - 1] : null)).filter(Boolean);
  assert.notEqual(gaps[0], gaps[1]);
});

test("presses land on the right moment; misses, early presses and late presses count correctly", () => {
  const p = { ...paramsFor("leap", { chance: 0.6 }) };
  const t = createTiming(p, "x");
  const [a, b, c] = t.times;
  assert.equal(t.press(), null, "too early to answer anything");
  t.advance(a);
  assert.equal(t.press().good, true, "on the instant");
  t.advance(b - a + p.window * 1.5);
  const late = t.press();
  assert.equal(late.index, 1);
  assert.equal(late.good, false, "late");
  t.advance(c - t.clock + 2);
  assert.ok(t.done);
  assert.equal(t.answers[2].missed, true, "never pressed");
  assert.equal(t.good, 1);
  assert.equal(t.pass, false);
  assert.ok(t.score > 0.33 && t.score < 0.6, "credit for the near miss");
});

test("an average player passes about as often as the dice would", () => {
  for (const kind of ["leap", "brace", "balance"])
    for (const chance of [0.3, 0.7]) {
      const p = paramsFor(kind, { chance });
      let passes = 0;
      const n = 300;
      for (let s = 0; s < n; s++) passes += simulatePlayer(p, `${kind}${chance}${s}`).pass;
      assert.ok(Math.abs(passes / n - chance) < 0.1, `${kind} at ${chance}: ${passes / n}`);
    }
});

import { scaleNeed, scaleStones } from "../site/world/trials/stage.js";
import { SKILL_KINDS } from "../site/engine/skills.js";

test("every skill kind has a calibrated shape or is the scale", () => {
  for (const kind of SKILL_KINDS) assert.ok(kind === "scale" || SHAPES[kind], kind);
});

test("the scale is as fair as an average roll, and its stones are the advantages earned", () => {
  assert.equal(scaleNeed({ dc: 9 }), 2);
  assert.equal(scaleNeed({ dc: 6 }), 0, "an easy check needs no argument at all");
  const parts = [
    { label: "Trust", value: 3 },
    { label: "Storm pressure", value: -2 },
    { label: "You know why he sealed it", value: 2 },
  ];
  assert.deepEqual(scaleStones({ parts }).map((s) => [s.label, s.weight]), [["Trust", 3], ["You know why he sealed it", 2]]);
  // Laying every earned stone passes exactly when the dice's average roll (7) would.
  for (let dc = 2; dc <= 16; dc++)
    for (const bonus of [0, 1, 2, 5, 9]) {
      const total = scaleStones({ parts: [{ label: "x", value: bonus }] }).reduce((n, s) => n + s.weight, 0);
      assert.equal(total >= scaleNeed({ dc }), 7 + bonus >= dc, `dc ${dc}, bonus ${bonus}`);
    }
});
