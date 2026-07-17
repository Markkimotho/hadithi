import test from "node:test";
import assert from "node:assert/strict";
import { Game, matches, validateEpisode } from "../site/game.js";
import { episodes, wisdom, tide, orchestra } from "../site/stories.js";

function choose(game, id) {
  if (
    game.state.returnScene &&
    !game.availableActions().some((a) => a.id === id)
  ) {
    const fallback = { wisdom: "shelter", tide: "wait", orchestra: "hide" }[
      game.episode.id
    ];
    const a = game.availableActions().find((a) => a.id === fallback);
    game.dispatch({ type: a.type, id: a.id });
  }
  const a = game.availableActions().find((a) => a.id === id);
  assert.ok(a, `Missing ${game.episode.id}/${game.state.scene}/${id}`);
  assert.ok(a.enabled, `Unavailable ${id}: ${a.requires}`);
  game.dispatch({ type: a.type, id: a.id });
  return game;
}
function path(game, ...ids) {
  ids.forEach((id) => choose(game, id));
  return game;
}
function solve(game) {
  if (game.state.returnScene)
    choose(
      game,
      { wisdom: "shelter", tide: "wait", orchestra: "hide" }[game.episode.id],
    );
  const p = game.view().puzzleData;
  p.solution.forEach((id) => game.dispatch({ type: "PUZZLE", id }));
}
function shift(game, id) {
  game.dispatch({ type: "SHIFT_THEME", id });
}

test("all authored episodes validate with at least three endings and eight events", () => {
  for (const ep of episodes) {
    assert.deepEqual(validateEpisode(ep), []);
    assert.ok(Object.keys(ep.scenes).length >= 12);
    assert.equal(Object.keys(ep.endings).length, 3);
    assert.ok(ep.events.length >= 8);
  }
});
test("validation rejects unknown items, destinations, triggers, duplicate events and disconnected scenes", () => {
  const ep = structuredClone(wisdom);
  ep.scenes.courtyard.actions[0].effects.give = ["fake"];
  ep.scenes.courtyard.actions[1].effects.to = "nowhere";
  ep.events.push(ep.events[0]);
  ep.events[1].when = { stat: "fake", gte: 1 };
  ep.scenes.disconnected = structuredClone(ep.scenes.council);
  const errors = validateEpisode(ep).join(" ");
  for (const text of [
    "unknown item",
    "unknown destination",
    "duplicate event",
    "unknown stat",
    "unreachable scene",
  ])
    assert.ok(errors.includes(text), text);
});
test("inspection is free, intentional pickups are one-time and invalid actions are atomic", () => {
  const g = new Game(wisdom);
  choose(g, "tracks");
  assert.equal(g.state.turn, 0);
  assert.equal(g.state.stats.insight, 1);
  assert.equal(g.state.inventory.length, 0);
  choose(g, "takeCord");
  const before = structuredClone(g.state);
  assert.throws(
    () => g.dispatch({ type: "TAKE_ITEM", id: "takeCord" }),
    /not available/,
  );
  assert.deepEqual(g.state, before);
  assert.throws(
    () => g.dispatch({ type: "TRAVEL", id: "council" }),
    /not available/,
  );
});
test("combining objects consumes materials and creates a new solution", () => {
  const g = new Game(wisdom);
  path(g, "takeCord", "market", "takeCloth");
  g.dispatch({ type: "COMBINE", id: "sling" });
  assert.ok(g.state.inventory.includes("sling"));
  assert.ok(!g.state.inventory.includes("cord"));
  assert.ok(!g.state.inventory.includes("cloth"));
  assert.throws(
    () => g.dispatch({ type: "COMBINE", id: "sling" }),
    /Missing materials/,
  );
});
test("all three wisdom endings can be reached through different decisions", () => {
  const shared = new Game(wisdom);
  path(
    shared,
    "market",
    "listen",
    "home",
    "trail",
    "river",
    "ford",
    "wade",
    "tree",
    "knot",
  );
  solve(shared);
  path(shared, "show", "hands", "council", "share");
  assert.equal(shared.state.ending, "shared");
  const keeper = new Game(wisdom);
  shift(keeper, "mystery");
  path(
    keeper,
    "trail",
    "river",
    "ford",
    "wade",
    "bark",
    "tree",
    "ledge",
    "hands",
    "council",
    "keeper",
  );
  assert.equal(keeper.state.ending, "keeper");
  const scattered = new Game(wisdom);
  path(scattered, "trail", "river", "ford", "wade", "tree", "ledge", "break");
  assert.equal(scattered.state.ending, "scattered");
});
test("a favor changes a later world event and resource state", () => {
  const helped = new Game(wisdom);
  path(helped, "trail", "river", "untangle", "ford", "wade");
  assert.ok(helped.state.fired.includes("favorReturns"));
  const alone = new Game(wisdom);
  path(alone, "trail", "river", "ford", "wade");
  assert.ok(!alone.state.fired.includes("favorReturns"));
  assert.ok(helped.state.stats.trust > alone.state.stats.trust);
});
test("puzzles permit retries, retain partial progress, and unlock authored solutions", () => {
  const g = new Game(tide);
  path(g, "untie", "channel", "quiet", "hall", "garden");
  for (const id of ["winter", "winter", "winter", "winter"])
    g.dispatch({ type: "PUZZLE", id });
  assert.equal(g.state.flags.dialSolved, undefined);
  assert.equal(g.state.puzzle.length, 0);
  g.dispatch({ type: "PUZZLE", id: "spring" });
  const resumed = Game.load(tide, g.save());
  assert.deepEqual(resumed.state.puzzle, ["spring"]);
  for (const id of ["summer", "autumn", "winter"])
    resumed.dispatch({ type: "PUZZLE", id });
  assert.ok(resumed.state.flags.dialSolved);
  choose(resumed, "stilled");
  assert.equal(resumed.state.scene, "stillwater");
});
test("all three tide endings are reachable; mystery changes the negotiated route", () => {
  const home = new Game(tide);
  shift(home, "mystery");
  path(
    home,
    "knife",
    "cut",
    "shell",
    "ask",
    "channel",
    "quiet",
    "promise",
    "hall",
    "garden",
  );
  solve(home);
  path(
    home,
    "stilled",
    "chart",
    "years",
    "archive",
    "research",
    "hall",
    "feast",
    "bargain",
    "accept",
  );
  assert.equal(home.state.ending, "home");
  const sea = new Game(tide);
  path(sea, "untie", "channel", "quiet", "hall", "feast", "homeSea", "stay");
  assert.equal(sea.state.ending, "sea");
  const century = new Game(tide);
  path(
    century,
    "untie",
    "channel",
    "fast",
    "hall",
    "feast",
    "gift",
    "box",
    "return",
    "current",
    "open",
  );
  assert.equal(century.state.ending, "century");
  assert.ok(century.state.flags.openedBox);
});
test("all three orchestra endings are reachable", () => {
  const home = new Game(orchestra);
  path(
    home,
    "bell",
    "dog",
    "invite",
    "cat",
    "invite",
    "rooster",
    "vote",
    "wood",
    "rehearsal",
  );
  solve(home);
  path(home, "ready", "song", "restore", "watch", "hold");
  assert.equal(home.state.ending, "home");
  const caseGame = new Game(orchestra);
  shift(caseGame, "mystery");
  path(
    caseGame,
    "dog",
    "invite",
    "cat",
    "invite",
    "rooster",
    "vote",
    "wood",
    "clearing",
    "sacks",
    "pantry",
    "risk",
    "witness",
    "agree",
    "escape",
    "case",
  );
  assert.equal(caseGame.state.ending, "case");
  const road = new Game(orchestra);
  path(
    road,
    "dog",
    "invite",
    "cat",
    "invite",
    "rooster",
    "rush",
    "wood",
    "clearing",
    "gate",
    "rush",
    "improvise",
    "escape",
    "road",
  );
  assert.equal(road.state.ending, "road");
});
test("genre shift is a meaningful one-time decision, with a specific new route", () => {
  const g = new Game(wisdom);
  path(g, "takeCord", "market", "takeCloth");
  g.dispatch({ type: "COMBINE", id: "sling" });
  shift(g, "survival");
  assert.throws(() => shift(g, "mystery"), /cannot shift/);
  path(g, "home", "trail", "ridge");
  assert.ok(g.availableActions().find((a) => a.id === "cross").enabled);
  choose(g, "cross");
  assert.equal(g.state.scene, "grove");
});
test("an active interrupt resumes identically and preserves the interrupted place", () => {
  const g = new Game(wisdom);
  path(g, "trail", "river");
  // Movement is deliberately repeated until the scheduled weather arrives.
  while (!g.state.returnScene) {
    const destination = g.state.scene === "river" ? "ridge" : "back";
    choose(g, destination);
  }
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
    {
      id: "later",
      on: "TAKE_ITEM",
      text: "later",
      delay: 2,
      effects: { stats: { insight: 1 } },
    },
    { id: "low", when: { item: "cord" }, text: "low", priority: 0 },
    {
      id: "high",
      when: { item: "cord" },
      text: "high",
      priority: 10,
      interrupt: "squall",
    },
  ];
  const g = new Game(ep);
  choose(g, "takeCord");
  assert.deepEqual(g.state.fired, ["high"]);
  assert.ok(g.state.scheduled.some((q) => q.id === "low"));
  choose(g, "shelter");
  assert.deepEqual(g.state.fired, ["high", "low", "later"]);
  const n = g.state.stats.insight;
  path(g, "market", "home", "market");
  assert.equal(g.state.stats.insight, n);
  assert.equal(g.state.fired.filter((id) => id === "later").length, 1);
});
test("save editions, corrupt commands and overlong saves fail clearly", () => {
  const g = new Game(wisdom);
  assert.throws(() => Game.load(tide, g.save()), /different story edition/);
  assert.throws(
    () => Game.load(wisdom, { ...g.save(), revision: 99 }),
    /different story edition/,
  );
  assert.throws(
    () =>
      Game.load(wisdom, {
        ...g.save(),
        actions: [{ type: "TRAVEL", id: "fake" }],
      }),
    /not available/,
  );
  assert.throws(
    () => Game.load(wisdom, { ...g.save(), actions: null }),
    /could not be read/,
  );
});
test("checkpoint replay retains inventory and relationships at the branch", () => {
  const g = new Game(wisdom);
  path(g, "trail", "river", "untangle", "ford", "wade");
  const checkpoint = structuredClone(g.state);
  path(g, "tree", "ledge", "break");
  const rewound = g.rewind();
  assert.equal(rewound.state.scene, "grove");
  assert.equal(rewound.state.ending, null);
  assert.deepEqual(rewound.state.stats, checkpoint.stats);
  assert.deepEqual(rewound.state.inventory, checkpoint.inventory);
});
test("conditions combine inventory, flags and numeric constraints", () => {
  const s = new Game(wisdom).state;
  assert.ok(
    matches({ all: [{ stat: "trust", gte: 1 }, { not: { item: "pot" } }] }, s),
  );
  assert.ok(
    !matches({ any: [{ flag: "madeUp" }, { stat: "trust", gte: 2 }] }, s),
  );
});

test("high pressure changes available solutions without trapping the player", () => {
  const g = new Game(wisdom);
  path(g, "trail", "river", "ford");
  g.apply({ stats: { danger: 8 } });
  assert.equal(
    g.availableActions().find((a) => a.id === "wade").enabled,
    false,
  );
  assert.ok(g.availableActions().some((a) => a.enabled));
  choose(g, "back");
  choose(g, "untangle");
  path(g, "ford", "ferry");
  assert.equal(g.state.scene, "grove");
});

test("survival opens a patrol response earned through route scouting", () => {
  const g = new Game(orchestra);
  shift(g, "survival");
  path(
    g,
    "dog",
    "invite",
    "cat",
    "invite",
    "rooster",
    "vote",
    "wood",
    "exitLine",
    "clearing",
    "pantry",
    "risk",
  );
  while (!g.state.returnScene) {
    const a =
      g.availableActions().find((a) => a.enabled && a.id === "back") ||
      g.availableActions().find((a) => a.enabled && a.id === "pantry");
    g.dispatch({ type: a.type, id: a.id });
  }
  const response = g.availableActions().find((a) => a.id === "exitLine");
  assert.ok(response.enabled);
  const before = g.state.stats.alert;
  g.dispatch({ type: response.type, id: response.id });
  assert.ok(g.state.stats.alert < before);
  assert.equal(g.state.returnScene, null);
});

test("recurring events respect a cooldown and a finite run limit", () => {
  const ep = structuredClone(wisdom);
  ep.events = [
    {
      id: "gust",
      when: { turn: 1 },
      maxRuns: 2,
      cooldown: 1,
      text: "Another gust.",
      effects: { stats: { danger: 1 } },
    },
  ];
  const g = new Game(ep);
  choose(g, "takeCord");
  assert.equal(g.state.eventRuns.gust, 1);
  choose(g, "tracks");
  assert.equal(g.state.eventRuns.gust, 1);
  path(g, "market", "home", "market");
  assert.equal(g.state.eventRuns.gust, 2);
  assert.equal(g.state.stats.danger, 2);
  assert.deepEqual(Game.load(ep, g.save()).state, g.state);
  ep.events[0].cooldown = 0;
  assert.ok(
    validateEpisode(ep).some((error) => error.includes("positive cooldown")),
  );
});
