import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../site/game.js";
import { wisdom } from "../site/stories.js";
import { createBridge } from "../site/world/bridge.js";

test("world commands use current availability and the bridge follows undo and shared ground", () => {
  let game = new Game(wisdom);
  const bridge = createBridge(() => game, (command) => game.dispatch(command));
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
  assert.equal(bridge.read().layout.width, 20, "the completed Wisdom slice has a mapped trail");
});

test("only declared, scene-appropriate physics facts cross the bridge and survive replay", () => {
  const ep = structuredClone(wisdom);
  ep.physicsFlags = { jarCracked: { text: "The jar cracked.", scenes: ["courtyard"] } };
  let game = new Game(ep);
  const bridge = createBridge(() => game, (command) => game.dispatch(command));
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
