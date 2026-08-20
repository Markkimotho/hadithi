// The engine side of the world bridge: skill outcomes, the fate ledger,
// check profiles, physics flags, and save v3.
import test from "node:test";
import assert from "node:assert/strict";
import { Game, SAVE_VERSION, validateEpisode } from "../site/game.js";
import { checkOdds, checkSucceeds, diceFor } from "../site/engine/rng.js";
import { SKILL_KINDS, skillErrors } from "../site/engine/skills.js";
import { wisdom, olives, episodes } from "../site/stories.js";
import { createBridge } from "../site/world/bridge.js";

const act = (g, id, outcome) => {
  const a = g.availableActions().find((x) => x.id === id);
  assert.ok(a?.enabled, `${id} available`);
  g.dispatch({ type: a.type, id, ...(outcome ? { outcome } : {}) });
  return g;
};
const toFord = (opts) => ["trail", "river", "ford"].reduce((g, id) => act(g, id), new Game(wisdom, opts));
const skill = (pass, score = pass ? 0.9 : 0.2) => ({ mode: "skill", pass, score });

test("a skill outcome decides the check, and the dice shown agree with it", () => {
  for (const pass of [true, false]) {
    for (let seed = 1; seed <= 40; seed++) {
      const g = act(toFord({ seed }), "leap", skill(pass));
      const r = g.state.lastRoll;
      assert.equal(r.success, pass);
      assert.equal(r.mode, "skill");
      assert.equal(checkSucceeds(r.dice, r.bonus, r.dc), pass, "dice agree with the result");
      assert.equal(Boolean(g.state.flags.soaked), !pass, "the authored outcome applies");
    }
  }
});

test("without an outcome the seeded dice still decide (Story mode)", () => {
  const g = act(toFord({ seed: 7 }), "leap");
  assert.equal(g.state.lastRoll.mode, "dice");
  assert.equal(g.state.lastRoll.score, null);
  assert.deepEqual(g.state.ledger, {}, "dice need no ledger entry");
});

test("replaying a save with skill outcomes reproduces the state exactly", () => {
  const g = act(toFord({ seed: 3 }), "leap", skill(false, 0.31));
  const loaded = Game.load(wisdom, g.save());
  assert.deepEqual(loaded.state, g.state);
  assert.equal(g.save().version, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 3);
});

test("undo cannot turn a failed skill attempt into a pass", () => {
  const g = act(toFord({ seed: 3 }), "leap", skill(false));
  const undone = g.undo();
  assert.equal(undone.state.scene, "ford");
  assert.deepEqual(undone.state.ledger, { "ford/leap#0": false }, "the ledger survives undo");
  act(undone, "leap", skill(true, 1));
  assert.equal(undone.state.lastRoll.success, false, "fate holds");
  // Switching to Story mode does not reroll it either.
  const again = g.undo();
  act(again, "leap");
  assert.equal(again.state.lastRoll.success, false);
});

test("a white check retried by skill still needs improved odds", () => {
  let g = null;
  for (let seed = 1; seed < 50 && !g; seed++) {
    const o = new Game(olives, { seed });
    act(o, "borrow", skill(false));
    g = o;
  }
  const retry = g.availableActions().find((a) => a.id === "borrow");
  assert.equal(retry.enabled, false);
  assert.throws(() => g.dispatch({ type: retry.type, id: "borrow", outcome: skill(true) }), /not available/);
  act(g, "hear");
  act(g, "borrow", skill(true));
  assert.equal(g.state.lastRoll.success, true, "the second attempt has its own fate");
  assert.equal(g.state.ledger["inn/borrow#1"], true);
});

test("malformed or misplaced outcomes are rejected atomically", () => {
  const g = toFord({ seed: 1 });
  const before = structuredClone(g.state);
  for (const outcome of [
    { mode: "skill", pass: "yes", score: 1 },
    { mode: "skill", pass: true, score: 2 },
    { mode: "dice", pass: true, score: 1 },
    { pass: true, score: 1 },
    null,
  ])
    assert.throws(() => g.dispatch({ type: "CHOOSE", id: "leap", outcome }), /could not be read/);
  assert.throws(() => g.dispatch({ type: "TRAVEL", id: "back", outcome: skill(true) }), /no skill/);
  assert.throws(() => g.dispatch({ type: "DEDUCE", ids: ["a", "b"], outcome: skill(true) }), /could not be read/);
  assert.deepEqual(g.state, before);
});

test("checkProfile matches the odds the player is shown", () => {
  const g = toFord({ seed: 1, assist: true });
  const leap = g.availableActions().find((a) => a.id === "leap");
  const profile = g.checkProfile(leap);
  assert.equal(profile.chance, checkOdds(profile.bonus, profile.dc));
  assert.equal(profile.chance, leap.odds.chance);
  assert.equal(profile.assist, true);
  assert.equal(g.checkProfile({ id: "x" }), null);
});

test("world skill profiles carry only the story evidence needed by the challenge", () => {
  const g = toFord({ seed: 1 });
  g.state.clues.push("promiseSeal");
  g.state.deductions.push("selfSealed");
  g.state.flags.behind = true;
  const bridge = createBridge(() => g, () => {});
  const profile = bridge.profile("leap");
  assert.equal(profile.chance, g.checkProfile(g.availableActions().find((a) => a.id === "leap")).chance);
  assert.deepEqual(profile.clues, ["promiseSeal"]);
  assert.deepEqual(profile.deductions, ["selfSealed"]);
  assert.ok(profile.flags.includes("behind"));
  assert.deepEqual(profile.stats, g.state.stats);
});

test("diceFor always finds dice that agree with the result", () => {
  for (let dc = 2; dc <= 20; dc++)
    for (const bonus of [-6, 0, 6])
      for (const success of [true, false]) {
        const dice = diceFor(11, `k${dc}`, bonus, dc, success);
        assert.equal(checkSucceeds(dice, bonus, dc), success);
      }
});

test("physics flags record a story fact once, cost no turn, and replay", () => {
  const ep = structuredClone(wisdom);
  ep.physicsFlags = {
    potKnocked: { text: "The pot rolls against the wall and rings.", scenes: ["courtyard"], effects: { clues: ["load"] } },
  };
  assert.deepEqual(validateEpisode(ep), []);
  const g = new Game(ep);
  const turn = g.state.turn;
  g.dispatch({ type: "PHYSICS", id: "potKnocked" });
  assert.equal(g.state.flags.potKnocked, true);
  assert.ok(g.state.clues.includes("load"));
  assert.equal(g.state.turn, turn);
  assert.throws(() => g.dispatch({ type: "PHYSICS", id: "potKnocked" }), /cannot happen/);
  assert.throws(() => g.dispatch({ type: "PHYSICS", id: "nope" }), /cannot happen/);
  assert.deepEqual(Game.load(ep, g.save()).state, g.state);
  act(g, "market");
  assert.equal(new Game(ep).state.flags.potKnocked, undefined);
  const elsewhere = act(new Game(ep), "market");
  assert.throws(() => elsewhere.dispatch({ type: "PHYSICS", id: "potKnocked" }), /cannot happen/, "scene-limited");
});

test("validation keeps physics flags to story facts and skills to known kinds", () => {
  const ep = structuredClone(wisdom);
  ep.physicsFlags = { cheat: { text: "x", effects: { ending: "shared" } }, quiet: { effects: {} } };
  const errors = validateEpisode(ep).join("\n");
  assert.match(errors, /physics flag cheat may only set/);
  assert.match(errors, /physics flag quiet needs text/);
  const leap = ep.scenes.ford.actions.find((a) => a.id === "leap");
  leap.check.skill = { kind: "juggle", pace: {} };
  const more = validateEpisode(ep).join("\n");
  assert.match(more, /unknown skill kind juggle/);
  assert.match(more, /skill parameter pace must be plain data/);
  assert.deepEqual(skillErrors({ kind: "leap", stones: 5, current: "fast", lanes: ["a"] }), []);
  assert.equal(SKILL_KINDS.length, 12);
});

test("v2 saves load into the v3 engine with an empty ledger", () => {
  for (const ep of episodes) {
    const g = new Game(ep);
    const v2 = { ...g.save(), version: 2 };
    delete v2.ledger;
    const loaded = Game.load(ep, v2);
    assert.deepEqual(loaded.state.ledger, {});
  }
});

test("a tampered ledger is cleaned, not trusted blindly", () => {
  const g = toFord({ seed: 1 });
  const save = { ...g.save(), ledger: { "ford/leap#0": "pass", ["x".repeat(300)]: true, ok: true } };
  assert.deepEqual(Game.load(wisdom, save).state.ledger, { ok: true });
});
