import test from "node:test";
import assert from "node:assert/strict";
import { challengeParameters } from "../site/world/skill-challenge.js";

test("skill challenge calibration follows the story check odds and assist", () => {
  const hard = challengeParameters("leap", { chance: 0.2 });
  const likely = challengeParameters("leap", { chance: 0.8 });
  const assisted = challengeParameters("leap", { chance: 0.2, assist: true });
  assert.ok(likely.timingWindow > hard.timingWindow);
  assert.ok(likely.timingSpeed < hard.timingSpeed);
  assert.ok(assisted.timingWindow > hard.timingWindow);
  assert.ok(assisted.threshold < hard.threshold);
  assert.ok(challengeParameters("brace", { chance: 4 }).timingWindow <= 32);
  assert.ok(challengeParameters("balance", { chance: -3 }).sway <= 1);
});
