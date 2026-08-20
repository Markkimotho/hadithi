import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("the tileset, prop sheet and character rigs satisfy the art contract", () => {
  const result = spawnSync(process.execPath, ["scripts/art-check.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /18 tiles, 16 prop slots, 2 puppet rigs/);
});
