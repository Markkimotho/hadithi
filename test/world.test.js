import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../site/game.js";
import { wisdom } from "../site/stories.js";
import { createBridge, playable } from "../site/world/bridge.js";
import { episodes } from "../site/stories.js";

// The shell's request handler, reduced to "send it to the engine".
const wire = (getGame) =>
  createBridge(getGame, {
    request: (action) => getGame().dispatch({ type: action.type, id: action.id }),
    command: (command) => getGame().dispatch(command),
  });

test("world commands use current availability and the bridge follows undo and shared ground", () => {
  let game = new Game(wisdom);
  const bridge = wire(() => game);
  bridge.action = (id) => bridge.request({ id });
  assert.equal(bridge.read().ground, "courtyard");
  assert.equal(bridge.action("gather"), false, "hidden echo choice stays hidden");
  assert.equal(bridge.action("takeCord"), true);
  assert.equal(bridge.action("takeCord"), false, "cannot take the cord twice");
  bridge.action("market");
  bridge.action("well");
  assert.equal(bridge.read().ground, "market");
  assert.equal(bridge.read().view.scene, "well");
  assert.equal(bridge.action("fill"), false, "requires an empty gourd");
  game = game.undo();
  assert.equal(bridge.read().view.scene, "market");
  bridge.action("home");
  bridge.action("trail");
  assert.ok(bridge.read().layout.width >= 20, "the completed Wisdom slice has a mapped trail");
});

test("only declared, scene-appropriate physics facts cross the bridge and survive replay", () => {
  const ep = structuredClone(wisdom);
  ep.physicsFlags = { jarCracked: { text: "The jar cracked.", scenes: ["courtyard"] } };
  let game = new Game(ep);
  const bridge = wire(() => game);
  bridge.action = (id) => bridge.request({ id });
  const prop = { source: { flag: "jarCracked" } };
  assert.equal(bridge.crack({ source: {} }), false);
  assert.equal(bridge.crack({ source: { flag: "unknown" } }), false);
  assert.equal(bridge.crack(prop), true);
  assert.equal(bridge.crack(prop), false);
  assert.equal(game.state.turn, 0);
  assert.deepEqual(Game.load(ep, game.save()).state, game.state);
  game = new Game(ep);
  bridge.action("market");
  assert.equal(bridge.crack(prop), false);
  assert.equal(game.state.flags.jarCracked, undefined);
});

test("only tales with a map for every scene can be played", () => {
  const open = episodes.filter(playable).map((ep) => ep.id);
  assert.ok(open.includes("wisdom"));
  for (const ep of episodes.filter((e) => !open.includes(e.id))) assert.ok(Object.keys(ep.scenes).length > 0);
});
