import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../site/style.css", import.meta.url), "utf8");
const MIN = 14;

// Each declaration with its line number, comments kept so a rule can carry an
// explicit exemption marker.
const declarations = css.split("\n").map((text, i) => ({ text, line: i + 1 }));

test("type tokens never resolve below the minimum size", () => {
  const tokens = [...css.matchAll(/--fs-[\w-]+: calc\((\d+)px \* var\(--scale\)\)/g)];
  assert.ok(tokens.length >= 6, "type scale tokens are defined");
  for (const [decl, px] of tokens) assert.ok(Number(px) >= MIN, decl);
  const story = css.match(/--story-size: calc\(clamp\((\d+)px/);
  assert.ok(story && Number(story[1]) >= 20, "story text starts at 20px or more");
});

test("no literal font size under 14px outside SVG user units", () => {
  const bad = declarations.filter(({ text }) => {
    if (text.includes("svg user units")) return false;
    const sizes = [...text.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    const rems = [...text.matchAll(/font-size:\s*(\d*\.\d+)rem/g)].map((m) => Number(m[1]) * 16);
    return [...sizes, ...rems].some((n) => n < MIN);
  });
  assert.deepEqual(bad.map((d) => `${d.line}: ${d.text.trim()}`), []);
});

test("no monospace labels, forced capitals, or wide tracking", () => {
  const bad = declarations.filter(
    ({ text }) =>
      /Courier|monospace/.test(text) ||
      /text-transform:\s*uppercase/.test(text) ||
      Number(text.match(/letter-spacing:\s*(\d*\.\d+)em/)?.[1] ?? 0) > 0.02,
  );
  assert.deepEqual(bad.map((d) => `${d.line}: ${d.text.trim()}`), []);
});

test("fonts are self-hosted and every face file is mapped", async () => {
  const faces = readFileSync(new URL("../site/fonts.css", import.meta.url), "utf8");
  assert.doesNotMatch(faces, /googleapis|gstatic/);
  const { VENDOR } = await import("../scripts/vendor.mjs");
  for (const [, file] of faces.matchAll(/url\(\.\/(fonts\/[^)]+)\)/g)) assert.ok(VENDOR[file], `${file} is mapped`);
});
