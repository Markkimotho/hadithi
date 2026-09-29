import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../site/game.js";
import { wisdom, olives } from "../site/stories.js";
import { beatsFor, splitSpeech, firstSpeech, changes } from "../site/ui/narrator.js";

const act = (g, id) => {
  const a = g.availableActions().find((x) => x.id === id);
  assert.ok(a?.enabled, id);
  const before = g.view();
  g.dispatch({ type: a.type, id });
  return beatsFor(g.episode, before, g.view());
};
const kinds = (beats) => beats.map((b) => b.kind);

test("speech is split from telling, quote marks kept with the speaker", () => {
  const parts = splitSpeech("A potter looks up. “Your father asked,” she says. “Trees keep secrets.”");
  assert.deepEqual(parts.map((p) => p.speech), [false, true, false, true]);
  assert.equal(parts[1].text, "“Your father asked,”");
  assert.equal(firstSpeech("No one speaks."), null);
  assert.equal(firstSpeech("She says, “Bring it back.”"), "Bring it back.");
  assert.equal(firstSpeech("“A meeting point,” the archivist says. “Not a guarantee.”"), "A meeting point. Not a guarantee.");
  assert.deepEqual(splitSpeech(""), []);
});

test("a new telling opens with the opening line, a chapter card, then the scene", () => {
  const g = new Game(wisdom);
  const beats = beatsFor(wisdom, null, g.view());
  assert.deepEqual(kinds(beats), ["narrate", "chapter", "narrate"]);
  assert.equal(beats[0].tone, "opening");
  assert.equal(beats[1].title, g.view().title);
  assert.equal(beats[2].text, g.view().description);
});

test("looking tells what you found and notes the clue and stat it gave", () => {
  const g = new Game(wisdom);
  const beats = act(g, "tracks");
  assert.deepEqual(kinds(beats), ["narrate"]);
  const notes = beats[0].notes;
  assert.ok(notes.some((n) => n.kind === "clue" && n.id === "load"));
  assert.ok(notes.some((n) => n.kind === "stat" && n.id === "insight" && n.delta === 1));
});

test("taking an object notes it going into the bag", () => {
  const g = new Game(wisdom);
  const beats = act(g, "takeCord");
  assert.deepEqual(beats[0].notes.filter((n) => n.kind === "item"), [{ kind: "item", id: "cord", gained: true, name: "Palm cord", glyph: "⌁" }]);
});

test("travel tells the going, then the new place opens as a chapter", () => {
  const g = new Game(wisdom);
  const beats = act(g, "market");
  assert.deepEqual(kinds(beats).slice(0, 3), ["narrate", "chapter", "narrate"]);
  assert.equal(beats[1].title, wisdom.scenes.market.title);
});

test("a roll comes first, then what it caused", () => {
  const g = new Game(wisdom, { seed: 5 });
  for (const id of ["trail", "river", "ford"]) act(g, id);
  const beats = act(g, "leap");
  assert.equal(beats[0].kind, "roll");
  assert.equal(beats[0].roll.key, "ford/leap");
  assert.ok(kinds(beats).includes("chapter"), "both outcomes cross to the grove");
});

test("connecting clues becomes one deduction beat with its meaning", () => {
  const g = new Game(olives);
  const pair = olives.deductions[0].from;
  // Give the clues directly through a synthetic state, then deduce.
  g.state.clues.push(...pair);
  const before = g.view();
  g.dispatch({ type: "DEDUCE", ids: pair });
  const beats = beatsFor(olives, before, g.view());
  const d = beats.find((b) => b.kind === "deduction");
  assert.equal(d.title, olives.deductions[0].title);
  assert.equal(d.text, olives.deductions[0].text);
});

test("an interruption is told before its scene opens", () => {
  // The storm breaks at turn 10 once you have gone into the wild.
  const g = new Game(wisdom);
  let beats = act(g, "trail");
  act(g, "river");
  for (let i = 0; i < 12 && !g.state.returnScene; i++) beats = act(g, g.state.scene === "river" ? "ridge" : "back");
  assert.equal(g.state.scene, "squall");
  const i = beats.findIndex((b) => b.tone === "encounter");
  const c = beats.findIndex((b) => b.kind === "chapter");
  assert.ok(i >= 0, "the storm is told");
  assert.ok(c > i, "then the squall opens as a chapter");
  assert.equal(beats[c].title, wisdom.scenes.squall.title);
});

test("changes() reports lost items too", () => {
  const before = { clues: [], inventory: ["gourd"], stats: { trust: 1 } };
  const after = { clues: [], inventory: ["water"], stats: { trust: 1 } };
  const notes = changes(wisdom, before, after);
  assert.deepEqual(notes.map((n) => [n.id, n.gained]), [["water", true], ["gourd", false]]);
});
