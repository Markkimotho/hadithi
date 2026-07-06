import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Game } from "../site/game.js";
const data = JSON.parse(await readFile(new URL("../game_data.json", import.meta.url)));
test("castle is reachable and unprepared player loses", () => {
  const game = new Game(data);
  game.move("castle"); game.move("boss_arena");
  while (game.status === "fighting") game.advance();
  assert.equal(game.status, "defeat");
});
test("collecting equipment allows victory", () => {
  const game = new Game(data);
  game.move("tavern"); game.move("village");
  game.move("forest"); game.move("forest_search"); game.move("forest"); game.move("village");
  game.move("shop"); game.move("shop_browse"); game.move("shop"); game.move("village");
  game.move("castle"); game.move("boss_arena");
  while (game.status === "fighting") game.advance();
  assert.equal(game.status, "victory");
});
test("invalid moves are rejected", () => assert.throws(() => new Game(data).move("boss_arena"), /not available/));
