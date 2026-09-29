import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("every tale's tileset, prop sheet and character rigs satisfy the art contract", () => {
  const result = spawnSync(process.execPath, ["scripts/art-check.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const tale of ["wisdom", "tide", "orchestra", "olives"]) assert.match(result.stdout, new RegExp(`${tale}: 18 tiles, \\d+ rigs`));
});
