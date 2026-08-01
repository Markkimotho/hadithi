import test from "node:test";
import assert from "node:assert/strict";
import { episodes, wisdom } from "../site/stories.js";
import { explore, endingWitnesses, search, moves, stateKey, turnHorizon } from "../site/engine/explore.js";
import { playthrough } from "../site/engine/simulate.js";
import { Game } from "../site/game.js";

test("search finds a witness path to every ending; secrets need echoes", () => {
  for (const ep of episodes) {
    const witnesses = endingWitnesses(ep, { budget: 50000 });
    for (const [id, w] of Object.entries(witnesses)) assert.ok(w.path, `${ep.id}/${id} unreachable`);
    for (const [id, e] of Object.entries(ep.endings))
      if (e.secret) {
        const without = search(ep, { ending: id, budget: 3000 });
        assert.equal(without.path, null, `${ep.id}/${id} reachable without echoes`);
      }
  }
});

test("the opening state space has no dead ends or engine errors", () => {
  for (const ep of episodes) {
    const r = explore(ep, { maxStates: 2500 });
    assert.equal(r.deadEndCount, 0, `${ep.id} dead end: ${r.deadEnds[0]}`);
    assert.equal(r.errorCount, 0, `${ep.id} error: ${JSON.stringify(r.errors[0])}`);
  }
});

test("explorer proves traps exist when content has them", () => {
  const ep = structuredClone(wisdom);
  // A one-way room with no exit except itself: every path into it is a trap.
  ep.scenes.pit = { title: "Pit", kicker: "", text: "", actions: [{ id: "pace", label: "Pace", type: "WAIT", effects: { flags: { paced: true } }, text: "" }] };
  ep.scenes.courtyard.actions.push({ id: "fall", label: "Fall", type: "TRAVEL", effects: { to: "pit" }, text: "" });
  const r = explore(ep, { maxStates: 400 });
  assert.ok(r.trapCount > 0 || r.truncated);
  const stuck = search(ep, { from: new Game(ep).state, budget: 50 });
  assert.ok(stuck.path, "the normal start can still finish");
  const g = new Game(ep);
  g.dispatch({ type: "TRAVEL", id: "fall" });
  assert.equal(search(ep, { from: g.state, budget: 500 }).path, null);
});

test("state keys ignore display-only differences and normalize time past the horizon", () => {
  const g = new Game(wisdom);
  const a = structuredClone(g.state);
  const b = structuredClone(g.state);
  b.log.push({ kind: "world", text: "noise" });
  b.flags.objective = "Something else";
  const h = turnHorizon(wisdom);
  assert.equal(stateKey(a, h, 1), stateKey(b, h, 1));
  a.turn = h + 5;
  b.turn = h + 9;
  assert.equal(stateKey(a, h, 1), stateKey(b, h, 1));
  assert.ok(moves(g).length >= 3);
});

test("seeded agents finish runs without dead ends and reproduce exactly", () => {
  for (const ep of episodes)
    for (const policy of ["random", "curious", "hasty"])
      for (let seed = 1; seed <= 6; seed++) {
        const r = playthrough(ep, { seed, policy });
        assert.equal(r.deadEnd, null, `${ep.id}/${policy}/${seed}`);
      }
  const a = playthrough(wisdom, { seed: 5, policy: "curious", trapEvery: 10, trapBudget: 3000 });
  const b = playthrough(wisdom, { seed: 5, policy: "curious" });
  assert.deepEqual(a.traps, []);
  assert.equal(a.ending, b.ending);
  assert.equal(a.signature, b.signature);
});
