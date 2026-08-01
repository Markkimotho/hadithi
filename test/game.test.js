import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  matches,
  validateEpisode,
  rollFor,
  checkOdds,
  seedCode,
  parseSeedCode,
  defaultSeed,
} from "../site/game.js";
import { episodes, wisdom, tide, orchestra, olives, regions } from "../site/stories.js";
import { walkthroughs, play } from "./walkthroughs.js";

function choose(game, id) {
  const a = game.availableActions().find((x) => x.id === id);
  assert.ok(a, `Missing ${game.episode.id}/${game.state.scene}/${id}`);
  assert.ok(a.enabled, `Unavailable ${id}: ${a.requires}`);
  game.dispatch({ type: a.type, id: a.id });
  return game;
}
const path = (game, ...ids) => {
  ids.forEach((id) => choose(game, id));
  return game;
};
const action = (game, id) => game.availableActions().find((a) => a.id === id);

// ── Content ──────────────────────────────────────────────────────────────

test("every tale validates and meets the anthology's scope targets", () => {
  assert.equal(episodes.length, 4);
  assert.deepEqual(regions, ["Africa", "Asia", "Europe", "Middle East"]);
  for (const ep of episodes) {
    assert.deepEqual(validateEpisode(ep), [], ep.id);
    const scenes = Object.keys(ep.scenes).length;
    const endings = Object.values(ep.endings);
    const checks = Object.values(ep.scenes).flatMap((s) => s.actions.filter((a) => a.check));
    assert.ok(scenes >= 12, `${ep.id}: ${scenes} scenes`);
    assert.ok(ep.events.length >= 8, `${ep.id}: events`);
    assert.ok(Object.keys(ep.items).length >= 4, `${ep.id}: items`);
    assert.ok(endings.filter((e) => !e.secret).length >= 3, `${ep.id}: endings`);
    assert.equal(endings.filter((e) => e.secret).length, 1, `${ep.id}: one secret ending`);
    assert.ok(checks.length >= 3, `${ep.id}: dice checks`);
    assert.ok(ep.deductions.length >= 3, `${ep.id}: deductions`);
    assert.ok(Object.keys(ep.echoes).length >= 2, `${ep.id}: echoes`);
    assert.ok(ep.marks.length >= 4, `${ep.id}: marks`);
    assert.ok(Object.keys(ep.characters).length >= 4, `${ep.id}: characters`);
    assert.ok(ep.events.some((e) => e.interrupt), `${ep.id}: an interrupt`);
    assert.equal(Object.keys(ep.themes).length, 3, `${ep.id}: three directions`);
  }
});

test("validation rejects broken references, dead content and unfair rules", () => {
  const ep = structuredClone(wisdom);
  ep.scenes.courtyard.actions[0].effects.give = ["fake"];
  ep.scenes.courtyard.actions[1].effects.to = "nowhere";
  ep.events.push(ep.events[0]);
  ep.events[1].when = { stat: "fake", gte: 1 };
  ep.scenes.disconnected = structuredClone(ep.scenes.council);
  ep.clues.orphan = "Nobody ever finds this.";
  ep.deductions.push({ id: "bad", from: ["load", "missing"], title: "x", text: "y" });
  ep.echoes.unused = { title: "x", text: "y", from: { ending: "shared" } };
  ep.scenes.ford.actions.find((a) => a.id === "leap").check.failure = { effects: {} };
  delete ep.scenes.ford.actions.find((a) => a.id === "safe").requires;
  ep.scenes.council.actions.find((a) => a.id === "story").visible = undefined;
  const errors = validateEpisode(ep).join(" ");
  for (const text of [
    "unknown item",
    "unknown destination",
    "duplicate event",
    "unknown stat",
    "unreachable scene",
    "clue orphan is never discovered",
    "deduction bad: unknown clue missing",
    "echo unused unlocks nothing",
    "check needs failure text",
    "needs a player-facing 'requires'",
    "secret ending storyteller must be gated by a remembered echo",
  ])
    assert.ok(errors.includes(text), text);
});

test("every ending, including each secret ending, has a replayable walkthrough", () => {
  for (const w of walkthroughs) {
    const g = play(w);
    assert.equal(g.state.ending, w.expect.ending, w.name);
    for (const m of w.expect.marks ?? []) assert.ok(g.state.marks.includes(m), `${w.name}: mark ${m}`);
  }
  for (const ep of episodes)
    for (const id of Object.keys(ep.endings))
      assert.ok(
        walkthroughs.some((w) => w.episode === ep.id && w.expect.ending === id),
        `${ep.id}/${id} lacks a walkthrough`,
      );
});

// ── Core rules ───────────────────────────────────────────────────────────

test("inspection is free, intentional pickups are one-time and invalid actions are atomic", () => {
  const g = new Game(wisdom);
  choose(g, "tracks");
  assert.equal(g.state.turn, 0);
  assert.equal(g.state.stats.insight, 1);
  assert.deepEqual(g.state.clues, ["load"]);
  choose(g, "takeCord");
  const before = structuredClone(g.state);
  assert.throws(() => g.dispatch({ type: "TAKE_ITEM", id: "takeCord" }), /not available/);
  assert.deepEqual(g.state, before);
  assert.throws(() => g.dispatch({ type: "TRAVEL", id: "council" }), /not available/);
  assert.throws(() => g.dispatch({ type: "DEDUCE", ids: ["load"] }), /could not be read/);
});

test("combining objects consumes materials and creates a new solution", () => {
  const g = new Game(wisdom);
  path(g, "takeCord", "market", "takeCloth");
  g.dispatch({ type: "COMBINE", id: "sling" });
  assert.ok(g.state.inventory.includes("sling"));
  assert.ok(!g.state.inventory.includes("cord"));
  assert.deepEqual(g.state.taken, ["cord", "cloth", "sling"]);
  assert.throws(() => g.dispatch({ type: "COMBINE", id: "sling" }), /Missing materials/);
});

test("a favor changes a later world event and resource state", () => {
  const helped = path(new Game(wisdom), "trail", "river", "untangle", "ford", "wade");
  assert.ok(helped.state.fired.includes("favorReturns"));
  assert.ok(helped.state.clues.includes("ferry"));
  const alone = path(new Game(wisdom), "trail", "river", "ford", "wade");
  assert.ok(!alone.state.fired.includes("favorReturns"));
  assert.ok(helped.state.stats.trust > alone.state.stats.trust);
});

test("puzzles permit retries, retain partial progress, and unlock authored solutions", () => {
  const g = path(new Game(tide), "untie", "channel", "quiet", "hall", "garden");
  for (const id of ["winter", "winter", "winter", "winter"]) g.dispatch({ type: "PUZZLE", id });
  assert.equal(g.state.flags.dialSolved, undefined);
  assert.equal(g.state.puzzle.length, 0);
  g.dispatch({ type: "PUZZLE", id: "spring" });
  const resumed = Game.load(tide, g.save());
  assert.deepEqual(resumed.state.puzzle, ["spring"]);
  for (const id of ["summer", "autumn", "winter"]) resumed.dispatch({ type: "PUZZLE", id });
  assert.ok(resumed.state.flags.dialSolved);
  choose(resumed, "stilled");
  assert.equal(resumed.state.scene, "stillwater");
});

test("genre shift is a meaningful one-time decision, with a specific new route", () => {
  const g = path(new Game(wisdom), "takeCord", "market", "takeCloth");
  g.dispatch({ type: "COMBINE", id: "sling" });
  g.dispatch({ type: "SHIFT_THEME", id: "survival" });
  assert.throws(() => g.dispatch({ type: "SHIFT_THEME", id: "mystery" }), /cannot shift/);
  path(g, "home", "trail", "ridge");
  assert.ok(action(g, "cross").enabled);
  choose(g, "cross");
  assert.equal(g.state.scene, "grove");
  const o = new Game(olives);
  assert.throws(() => o.dispatch({ type: "SHIFT_THEME", id: "wonder" }), /cannot shift/);
  o.dispatch({ type: "SHIFT_THEME", id: "diplomacy" });
  assert.equal(o.state.theme, "diplomacy");
});

test("an active interrupt resumes identically and preserves the interrupted place", () => {
  const g = path(new Game(wisdom), "trail", "river");
  while (!g.state.returnScene) choose(g, g.state.scene === "river" ? "ridge" : "back");
  assert.equal(g.state.scene, "squall");
  const originalReturn = g.state.returnScene;
  const loaded = Game.load(wisdom, g.save());
  assert.deepEqual(loaded.state, g.state);
  choose(loaded, "shelter");
  assert.equal(loaded.state.scene, originalReturn);
  assert.equal(loaded.state.returnScene, null);
});

test("event priority preserves interrupts and delayed events fire exactly once", () => {
  const ep = structuredClone(wisdom);
  ep.events = [
    { id: "later", on: "TAKE_ITEM", text: "later", delay: 2, effects: { stats: { insight: 1 } } },
    { id: "low", when: { item: "cord" }, text: "low", priority: 0 },
    { id: "high", when: { item: "cord" }, text: "high", priority: 10, interrupt: "squall" },
  ];
  const g = choose(new Game(ep), "takeCord");
  assert.deepEqual(g.state.fired, ["high"]);
  assert.ok(g.state.scheduled.some((q) => q.id === "low"));
  choose(g, "shelter");
  assert.deepEqual(g.state.fired, ["high", "low", "later"]);
  const n = g.state.stats.insight;
  path(g, "market", "home", "market");
  assert.equal(g.state.stats.insight, n);
});

test("a delayed event with recheck is dropped if its guard no longer holds", () => {
  for (const recheck of [true, false]) {
    const ep = structuredClone(wisdom);
    ep.events = [
      { id: "late", when: { all: [{ item: "cord" }, { scene: "courtyard" }] }, delay: 1, recheck, text: "late" },
    ];
    const g = path(new Game(ep), "takeCord");
    assert.ok(g.state.scheduled.some((q) => q.id === "late"));
    choose(g, "market");
    assert.equal(g.state.fired.includes("late"), !recheck);
    assert.equal(g.state.scheduled.length, 0);
  }
});

test("recurring events respect a cooldown and a finite run limit", () => {
  const ep = structuredClone(wisdom);
  ep.events = [
    { id: "gust", when: { turn: 1 }, maxRuns: 2, cooldown: 1, text: "Another gust.", effects: { stats: { danger: 1 } } },
  ];
  const g = choose(new Game(ep), "takeCord");
  assert.equal(g.state.eventRuns.gust, 1);
  choose(g, "tracks");
  assert.equal(g.state.eventRuns.gust, 1);
  path(g, "market", "home", "market");
  assert.equal(g.state.eventRuns.gust, 2);
  assert.equal(g.state.stats.danger, 2);
  assert.deepEqual(Game.load(ep, g.save()).state, g.state);
  ep.events[0].cooldown = 0;
  assert.ok(validateEpisode(ep).some((error) => error.includes("positive cooldown")));
});

test("high pressure changes available solutions without trapping the player", () => {
  const g = path(new Game(wisdom), "trail", "river", "ford");
  g.apply({ stats: { danger: 8 } });
  assert.equal(action(g, "wade").enabled, false);
  assert.ok(g.availableActions().some((a) => a.enabled));
  path(g, "back", "untangle", "ford", "ferry");
  assert.equal(g.state.scene, "grove");
});

test("survival opens a patrol response earned through route scouting", () => {
  const g = new Game(orchestra);
  g.dispatch({ type: "SHIFT_THEME", id: "survival" });
  path(g, "dog", "invite", "cat", "invite", "rooster", "vote", "wood", "exitLine", "clearing", "pantry", "risk");
  while (!g.state.returnScene) {
    const a = action(g, "back")?.enabled ? action(g, "back") : action(g, "pantry");
    g.dispatch({ type: a.type, id: a.id });
  }
  const response = action(g, "exitLine");
  assert.ok(response.enabled);
  const before = g.state.stats.alert;
  g.dispatch({ type: response.type, id: response.id });
  assert.ok(g.state.stats.alert < before);
  assert.equal(g.state.returnScene, null);
});

test("conditions cover inventory, flags, numbers, clues, deductions, echoes and counts", () => {
  const g = new Game(wisdom, { echoes: ["circle"] });
  choose(g, "tracks");
  const s = g.state;
  assert.ok(matches({ all: [{ stat: "trust", gte: 1 }, { not: { item: "pot" } }] }, s));
  assert.ok(!matches({ any: [{ flag: "madeUp" }, { stat: "trust", gte: 2 }] }, s));
  assert.ok(matches({ clue: "load" }, s));
  assert.ok(matches({ echo: "circle" }, s));
  assert.ok(!matches({ echo: "openDoor" }, s));
  assert.ok(matches({ count: "clues", gte: 1, lte: 1 }, s));
  assert.ok(matches({ count: "turn", lte: 0 }, s));
  assert.ok(!matches({ deduction: "whyHide" }, s));
  assert.ok(!matches({ check: "tree/ledge" }, s));
  assert.throws(() => matches({ nonsense: true }, s), /Unknown story condition/);
});

// ── Dice ─────────────────────────────────────────────────────────────────

test("dice are seeded, uniform, and their displayed odds are exact", () => {
  assert.deepEqual(rollFor(42, "a"), rollFor(42, "a"));
  const counts = Array(13).fill(0);
  for (let i = 0; i < 36000; i++) {
    const [a, b] = rollFor(7, `k${i}`);
    assert.ok(a >= 1 && a <= 6 && b >= 1 && b <= 6);
    counts[a + b]++;
  }
  assert.ok(Math.abs(counts[7] / 36000 - 6 / 36) < 0.01, `sevens ${counts[7]}`);
  assert.ok(Math.abs(counts[2] / 36000 - 1 / 36) < 0.005, `twos ${counts[2]}`);
  assert.equal(checkOdds(0, 7), 21 / 36);
  assert.equal(checkOdds(0, 2), 35 / 36, "double one always fails");
  assert.equal(checkOdds(-20, 12), 1 / 36, "double six always succeeds");
  assert.equal(checkOdds(20, 30), 6 / 36);
  assert.equal(checkOdds(20, 40), 1 / 36);
  for (const seed of [0, 1, 123456, 0xffffffff]) assert.equal(parseSeedCode(seedCode(seed)), seed);
  assert.equal(parseSeedCode("not a seed!"), null);
});

test("a check shows itemized odds and resolves the same way on replay and undo", () => {
  const g = path(new Game(wisdom, { seed: 99 }), "trail", "river", "untangle", "ford");
  const leap = action(g, "leap");
  assert.equal(leap.odds.dc, 8);
  assert.equal(leap.odds.kind, "red");
  assert.deepEqual(leap.odds.parts.map((p) => p.label), ["Insight", "Ferryman’s tip"]);
  assert.equal(leap.odds.chance, checkOdds(leap.odds.bonus, 8));
  choose(g, "leap");
  const roll = g.state.lastRoll;
  assert.equal(roll.dc, 8);
  assert.equal(roll.success, roll.dice[0] + roll.dice[1] + roll.bonus >= 8 || roll.dice.join() === "6,6");
  assert.equal(g.state.scene, "grove", "both outcomes cross the river");
  assert.deepEqual(Game.load(wisdom, g.save()).state.lastRoll, roll);
  const undone = g.undo();
  assert.equal(undone.state.scene, "ford");
  choose(undone, "leap");
  assert.deepEqual(undone.state.lastRoll, roll, "undo cannot reroll a check");
  assert.equal(g.state.log.filter((e) => e.kind === "roll").length, 1);
});

test("different seeds produce different fortunes from the same choices", () => {
  const outcomes = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const g = path(new Game(wisdom, { seed }), "trail", "river", "ford", "leap");
    outcomes.add(g.state.lastRoll.success);
  }
  assert.deepEqual([...outcomes].sort(), [false, true]);
});

test("red checks are spent after one attempt; white checks retry only after the odds improve", () => {
  const g = path(new Game(wisdom), "trail", "river", "ford", "leap");
  const back = path(g, "back");
  assert.equal(back.state.scene, "ford");
  assert.equal(action(back, "leap"), undefined, "red check is gone");

  let failing = null;
  for (let seed = 1; seed < 500 && !failing; seed++) {
    const o = path(new Game(olives, { seed }), "borrow");
    if (!o.state.lastRoll.success) failing = o;
  }
  assert.ok(failing, "some seed fails the borrow check");
  const retry = action(failing, "borrow");
  assert.equal(retry.enabled, false);
  assert.equal(retry.requires, "Improve your odds to try again");
  choose(failing, "hear");
  const improved = action(failing, "borrow");
  assert.ok(improved.odds.bonus > failing.state.checks["inn/borrow"].bonus);
  assert.ok(improved.enabled);
  assert.equal(improved.odds.attempts, 1);
});

test("assist mode adds an itemized bonus and travels with the save", () => {
  const g = path(new Game(wisdom, { assist: true }), "trail", "river", "ford");
  assert.ok(action(g, "leap").odds.parts.some((p) => p.label === "Storyteller’s grace" && p.value === 2));
  assert.equal(Game.load(wisdom, g.save()).state.assist, true);
});

test("explorer hooks can force either outcome of a check", () => {
  for (const force of [true, false]) {
    const g = path(new Game(wisdom), "trail", "river", "ford");
    g.forceRoll = () => force;
    choose(g, "leap");
    assert.equal(g.state.lastRoll.success, force);
    assert.equal(Boolean(g.state.flags.soaked), !force);
  }
});

// ── Deductions ───────────────────────────────────────────────────────────

test("connecting clues is free; wrong links are recorded, right ones change the world", () => {
  const g = path(new Game(wisdom), "tracks", "market", "listen", "secret");
  const turn = g.state.turn;
  assert.throws(() => g.dispatch({ type: "DEDUCE", ids: ["load", "lonely"] }), /clues you have found/);
  g.dispatch({ type: "DEDUCE", ids: ["load", "treeSecret"] });
  assert.equal(g.state.wrongLinks, 1);
  assert.equal(g.state.turn, turn);
  const insight = g.state.stats.insight;
  g.dispatch({ type: "DEDUCE", ids: ["carry", "load"] });
  assert.deepEqual(g.state.deductions, ["wrongWay"]);
  assert.equal(g.state.stats.insight, insight + 1);
  assert.equal(g.state.turn, turn);
  const before = structuredClone(g.state);
  assert.throws(() => g.dispatch({ type: "DEDUCE", ids: ["load", "carry"] }), /already connected/);
  assert.deepEqual(g.state, before);
  const loaded = Game.load(wisdom, g.save());
  assert.deepEqual(loaded.state.deductions, ["wrongWay"]);
  assert.equal(loaded.state.wrongLinks, 1);
  path(g, "home", "trail", "river", "ford", "wade", "tree");
  assert.ok(action(g, "behind"), "the deduction opens a new conversation");
});

// ── Echoes, secrets, marks ───────────────────────────────────────────────

test("endings teach echoes; echoes reveal remembered actions in the next telling", () => {
  const first = play(walkthroughs.find((w) => w.expect.ending === "scattered"));
  assert.deepEqual(first.state.earnedEchoes, ["childsTale"]);
  const fresh = path(new Game(wisdom), "trail", "river", "ford", "wade", "tree");
  assert.equal(action(fresh, "childStory"), undefined);
  const council = new Game(wisdom);
  assert.ok(!council.availableActions().some((a) => a.remembered));
  const second = path(new Game(wisdom, { echoes: first.state.earnedEchoes }), "trail", "river", "ford", "wade", "tree");
  const remembered = action(second, "childStory");
  assert.ok(remembered.remembered);
  assert.deepEqual(Game.load(wisdom, second.save()).state.echoes, ["childsTale"]);
  const unknown = new Game(wisdom, { echoes: ["childsTale", "notAnEcho"] });
  assert.deepEqual(unknown.state.echoes, ["childsTale"]);
});

test("marks are awarded at the ending from the final state", () => {
  const g = play(walkthroughs.find((w) => w.expect.ending === "scattered"));
  assert.ok(g.state.marks.includes("light"));
  const item = g.view().markItems.find((m) => m.id === "light");
  assert.equal(item.title, "Light hands");
});

// ── Saves ────────────────────────────────────────────────────────────────

test("save editions, corrupt commands and overlong saves fail clearly", () => {
  const g = new Game(wisdom);
  assert.throws(() => Game.load(tide, g.save()), /different story edition/);
  assert.throws(() => Game.load(wisdom, { ...g.save(), revision: 99 }), /different story edition/);
  assert.throws(() => Game.load(wisdom, { ...g.save(), actions: [{ type: "TRAVEL", id: "fake" }] }), /not available/);
  assert.throws(() => Game.load(wisdom, { ...g.save(), actions: null }), /could not be read/);
  assert.throws(() => Game.load(wisdom, { ...g.save(), seed: -1 }), /could not be read/);
  assert.throws(() => Game.load(wisdom, null), /different story edition/);
});

test("first-edition saves migrate by replaying through the current rules", () => {
  const v1 = {
    version: 1,
    episodeId: "wisdom",
    revision: 1,
    actions: [
      { type: "TRAVEL", id: "trail" },
      { type: "TRAVEL", id: "river" },
      { type: "TALK", id: "untangle" },
      { type: "TRAVEL", id: "ford" },
    ],
    savedAt: "2026-10-01T00:00:00.000Z",
  };
  const g = Game.load(wisdom, v1);
  assert.equal(g.migratedFrom, 1);
  assert.equal(g.state.scene, "ford");
  assert.equal(g.state.seed, defaultSeed(wisdom));
  assert.equal(g.save().revision, 2);
  assert.throws(
    () => Game.load(wisdom, { ...v1, actions: [{ type: "TRAVEL", id: "nowhere" }] }),
    /earlier edition/,
  );
  assert.throws(() => Game.load(olives, { ...v1, episodeId: "olives", revision: 0 }), /different story edition/);
});

test("checkpoint replay retains inventory and relationships at the branch", () => {
  const g = path(new Game(wisdom), "trail", "river", "untangle", "ford", "wade");
  const checkpoint = structuredClone(g.state);
  path(g, "tree", "ledge", "break");
  const rewound = g.rewind();
  assert.equal(rewound.state.scene, "grove");
  assert.equal(rewound.state.ending, null);
  assert.deepEqual(rewound.state.stats, checkpoint.stats);
  assert.deepEqual(rewound.state.inventory, checkpoint.inventory);
});

test("undo steps back one command and is unavailable before the first move or after an ending", () => {
  const g = new Game(tide);
  assert.equal(g.view().canUndo, false);
  assert.throws(() => g.undo(), /Nothing to undo/);
  choose(g, "knife");
  const back = g.undo();
  assert.deepEqual(back.state.inventory, []);
  assert.equal(back.state.turn, 0);
  const done = play(walkthroughs.find((w) => w.expect.ending === "sea"));
  assert.throws(() => done.undo(), /ended/);
});

// ── View: map, people, atmosphere ────────────────────────────────────────

test("the map shows only discovered places, with exits from here", () => {
  const g = new Game(wisdom);
  let map = g.view().map;
  assert.deepEqual(map.nodes.map((n) => n.id), ["courtyard"]);
  assert.equal(map.here, "courtyard");
  assert.deepEqual(map.exits.map((e) => e.to).sort(), ["market", "trail"]);
  assert.ok(map.exits.every((e) => !e.known));
  path(g, "market", "home");
  map = g.view().map;
  assert.deepEqual(map.edges, [["courtyard", "market"]]);
  assert.ok(map.exits.find((e) => e.to === "market").known);
  const trial = path(new Game(olives), "street", "fountain").view();
  assert.ok(trial.map.nodes.every((n) => olives.scenes[n.id].map));
  const o = play({ episode: "olives", name: "jar", steps: ["street", "fountain", "wait:6", "call", "begin"] });
  assert.equal(o.state.scene, "trialJar");
  assert.equal(o.view().map.here, "trial", "staged scenes map to their place");
});

test("people appear when met and their notes grow with what you learn", () => {
  const g = new Game(wisdom);
  let people = g.view().people;
  assert.deepEqual(people.map((p) => p.id), ["anansi"]);
  assert.equal(people[0].notes.length, 1);
  assert.deepEqual(people[0].disposition, { label: "Trust", value: 1 });
  path(g, "tracks", "market");
  people = g.view().people;
  assert.deepEqual(people.map((p) => p.id), ["anansi", "potter"]);
  assert.equal(people[0].notes.length, 2);
});

test("atmosphere follows time, weather and place", () => {
  const g = new Game(wisdom);
  assert.deepEqual(g.view().atmosphere, { weather: "none", light: "dawn", ambience: "wind" });
  path(g, "market");
  assert.equal(g.view().atmosphere.ambience, "market");
  const stormy = path(new Game(wisdom), "trail", "river");
  while (!stormy.state.returnScene) choose(stormy, stormy.state.scene === "river" ? "ridge" : "back");
  assert.equal(stormy.view().atmosphere.weather, "storm");
  choose(stormy, "shelter");
  assert.equal(stormy.view().atmosphere.weather, "rain");
  const night = play({ episode: "olives", name: "moon", steps: ["street", "fountain", "wait:6", "call"] });
  assert.equal(night.view().atmosphere.light, "moon");
});
