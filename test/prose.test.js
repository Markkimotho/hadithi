import test from "node:test";
import assert from "node:assert/strict";
import { episodes } from "../site/stories.js";
import { lintText, lintNarration, lintEpisode, proseOf } from "../scripts/prose-lint.mjs";

test("lint catches the habits it exists for", () => {
  assert.match(lintText("The council will delve into it.").join(), /banned word "delve"/);
  assert.match(lintText("It showcases the river.").join(), /banned word "showcases"/);
  assert.match(lintText("You notice a pot.").join(), /stock phrase/);
  assert.match(lintText("He waits—listening.").join(), /em dash/);
  assert.match(lintText("The pot is gone. Some things are too large to keep.").join(), /closing maxim/);
  assert.match(lintText("You walk on. Every action leaves a trace.").join(), /closing maxim/);
  assert.deepEqual(lintText("The storm reaches you. Everything loose begins to move."), []);
  assert.deepEqual(lintText("Cold ash. Mother’s big pot is gone from its three stones."), []);
});

test("strict narration rules catch flat rhythm, repeated openers, semicolons", () => {
  assert.match(lintNarration("The fire is cold. The pot is gone now. The wall is very tall.").join(), /flat rhythm/);
  assert.match(lintNarration("He runs. He hides behind the long low wall of the compound. He waits.").join(), /open with "he"/);
  assert.match(lintNarration("The rain stops; the river does not.").join(), /semicolon/);
  // A quick exchange of dialogue is not flat narration.
  assert.deepEqual(lintNarration("“Three years,” says one. “Never more,” says the other. “Not one day more,” they say."), []);
  assert.deepEqual(lintNarration("A spice seller lowers her voice. “His wife wanted olives. Wanted them badly. Then she stopped.” The merchant looks up from his scales across the street."), []);
  // But the storyteller's own sentences still are.
  assert.match(lintNarration("“Yes,” she says. The fire is cold. The pot is gone now. The wall is very tall.").join(), /flat rhythm/);
  assert.deepEqual(
    lintNarration("Cold ash. Mother’s big pot is gone from its three stones, and so is Father. He swept leaves over his footprints, but he swept the way he does everything: fast, and only on the side he could see."),
    [],
  );
});

test("lint reads every player-facing string, not ids or urls", () => {
  const strings = proseOf(episodes[0]);
  assert.ok(strings.length > 200);
  assert.ok(strings.every((s) => !/^https?:/.test(s.text)));
  assert.ok(strings.some((s) => s.path.startsWith("scenes.courtyard")));
});

for (const ep of episodes)
  test(`${ep.id}: prose passes ${ep.voice >= 3 ? "strict" : "universal"} lint`, () => {
    assert.deepEqual(lintEpisode(ep).map((i) => `${i.path}: ${i.issue}`), []);
  });
