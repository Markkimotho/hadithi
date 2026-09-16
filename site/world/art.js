// Vector scenery and people for the world, drawn in code. Commissioned art
// replaces these drawings per kind (docs/ART-SPEC.md) without touching story
// or physics code. Every prop is drawn with its origin at the centre of its
// top-left tile; multi-tile props extend right and down.
export const TILE = 40;
export const TILE_FRAME = { ".": 0, ",": 1, '"': 2, ":": 3, _: 4, "~": 5, w: 6, "+": 7, s: 8, r: 9, m: 10, "#": 11, "=": 12, o: 13, T: 14, b: 15, h: 16, " ": 17 };

export function drawGround(scene, layout, atlas = "wisdom-tiles") {
  const ground = scene.add.container(0, 0).setDepth(-100);
  layout.grid.forEach((row, y) =>
    row.forEach((tile, x) => {
      const frame = TILE_FRAME[tile] ?? TILE_FRAME[" "];
      ground.add(scene.add.image(x * TILE, y * TILE, atlas, frame).setOrigin(0).setDisplaySize(TILE, TILE));
    }),
  );
  return ground;
}

const shadow = (g, cx, cy, w, h = w * 0.35, a = 0.28) => g.fillStyle(0x1e2618, a).fillEllipse(cx, cy, w, h);
const TINTS = { red: 0xa85c43, gold: 0xc1a05a, indigo: 0x536375, green: 0x63794c, kitchen: 0x9a6a46 };

/** Leaf clusters for canopies: overlapping discs in two greens. */
function canopy(g, cx, cy, rx, ry, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle(0x2f4a2c, 1).fillEllipse(cx, cy + 6, rx * 2, ry * 2);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2,
      r = rnd() * 0.75;
    g.fillStyle(i % 3 ? 0x3d5c35 : 0x4d6d3f, 1).fillCircle(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, 14 + rnd() * 16);
  }
  for (let i = 0; i < 9; i++) g.fillStyle(0x6c8a4f, 0.55).fillCircle(cx - rx * 0.4 + rnd() * rx * 0.9, cy - ry * 0.5 + rnd() * ry * 0.5, 5 + rnd() * 6);
}

export function drawProp(scene, p) {
  const g = scene.add.graphics();
  const w = (p.w ?? 1) * TILE,
    h = (p.h ?? 1) * TILE;
  const L = -TILE / 2,
    T = -TILE / 2; // top-left of the footprint
  const cx = L + w / 2,
    by = T + h; // centre x, bottom y
  switch (p.kind) {
    case "hut": {
      shadow(g, cx, by - 6, w + 10, 26);
      g.fillStyle(TINTS[p.tint] ?? 0xb37e50).fillRect(L + 4, T + h * 0.35, w - 8, h * 0.6);
      g.fillStyle(0x614332).fillRect(cx - 14, by - 46, 28, 42);
      g.fillStyle(0x8e6544).fillTriangle(L - 8, T + h * 0.4, L + w + 8, T + h * 0.4, cx, T - 40);
      g.lineStyle(3, 0xc7a06a, 0.7);
      for (let x = L; x <= L + w; x += 12) g.lineBetween(cx, T - 36, x, T + h * 0.38);
      break;
    }
    case "stall": {
      shadow(g, cx, by - 6, w + 10, 24);
      g.fillStyle(0x624c36).fillRect(L + 6, T + 14, w - 12, h - 18);
      g.fillStyle(TINTS[p.tint] ?? 0xb1804d).fillRect(L - 2, T - 6, w + 4, h * 0.55);
      g.lineStyle(3, 0xead3a0, 0.5);
      for (let x = L + 6; x < L + w; x += 16) g.lineBetween(x, T - 6, x, T + h * 0.55 - 6);
      break;
    }
    case "jar":
    case "pot":
      shadow(g, 0, 12, 30);
      g.fillStyle(0x82533c).fillEllipse(0, -2, 27, 32);
      g.fillStyle(0xc29064).fillEllipse(-3, -5, 20, 27);
      g.fillStyle(0x593f31).fillEllipse(0, -18, 15, 7);
      break;
    case "bigpot": {
      // The pot of wisdom: wide belly, two wax seals on the neck.
      shadow(g, 0, 16, 52, 18);
      g.fillStyle(0x6e4430).fillEllipse(0, -4, 50, 46);
      g.fillStyle(0xa86f4c).fillEllipse(-6, -8, 36, 34);
      g.fillStyle(0x5b3a29).fillRect(-11, -36, 22, 12);
      g.fillStyle(0x3e2a20).fillEllipse(0, -36, 24, 8);
      g.fillStyle(0xb8402c).fillCircle(-6, -30, 5);
      g.fillStyle(0xd88b3a).fillCircle(7, -29, 4);
      g.lineStyle(2, 0xe9c99b, 0.6).strokeEllipse(-6, -8, 28, 10);
      break;
    }
    case "well":
    case "firepit":
    case "potring":
      shadow(g, 0, 8, 46);
      g.fillStyle(0xc1a374).fillEllipse(0, 0, 43, 27);
      g.fillStyle(0x4e4837).fillEllipse(0, -4, 29, 16);
      if (p.kind === "well") {
        g.lineStyle(5, 0x614936).lineBetween(-19, -10, -19, -56).lineBetween(19, -10, 19, -56).lineBetween(-23, -56, 23, -56);
        g.lineStyle(2, 0xd1b582).lineBetween(0, -56, 0, -4);
      }
      if (p.kind === "firepit") g.fillStyle(0x6b6255).fillCircle(-6, -4, 3).fillCircle(5, -2, 3);
      break;
    case "fire": {
      shadow(g, 0, 10, 54, 20, 0.35);
      g.fillStyle(0x8a7a62).fillEllipse(0, 4, 46, 22);
      g.fillStyle(0x3a2a1c).fillEllipse(0, 2, 34, 14);
      g.lineStyle(5, 0x5a3e28).lineBetween(-14, 4, 12, -4).lineBetween(-12, -4, 14, 5);
      g.fillStyle(0xe2762f, 0.95).fillTriangle(-12, 0, 0, -30, 10, 0);
      g.fillStyle(0xf3c14d, 0.95).fillTriangle(-6, 0, 2, -20, 8, 0);
      g.fillStyle(0xf8e7a0, 0.25).fillCircle(0, -8, 34);
      break;
    }
    case "leaves":
      g.fillStyle(0x667248).fillEllipse(0, 0, 20, 8).fillEllipse(10, 9, 14, 6);
      break;
    case "cloth":
      g.fillStyle(0xcbba86).fillRoundedRect(-16, -10, 32, 20, 3);
      g.lineStyle(3, 0x945e42).lineBetween(-12, -4, 12, -4);
      g.lineStyle(2, 0x3b6a73).lineBetween(-12, 3, 12, 3);
      break;
    case "gourd":
      shadow(g, 0, 12, 22);
      g.fillStyle(0xc39e59).fillCircle(0, 2, 12).fillCircle(0, -10, 7);
      g.fillStyle(0x7a5a2c).fillRect(-2, -20, 4, 5);
      break;
    case "reeds":
      for (let i = -3; i <= 3; i++) {
        g.lineStyle(3, i % 2 ? 0x9aa067 : 0xb8b07a).lineBetween(i * 5, 12, i * 6, -26 + Math.abs(i) * 4);
        g.fillStyle(0x7c5a35).fillEllipse(i * 6, -26 + Math.abs(i) * 4, 4, 10);
      }
      break;
    case "rack":
      shadow(g, cx, by - 8, w, 14);
      g.lineStyle(5, 0x6a4b33).lineBetween(L + 6, by - 8, L + 6, T - 6).lineBetween(L + w - 6, by - 8, L + w - 6, T - 6);
      g.lineStyle(4, 0x8a6a46).lineBetween(L + 2, T, L + w - 2, T);
      g.lineStyle(3, 0xc9b27a).lineBetween(L + 14, T, L + 14, T + 22).lineBetween(L + 30, T, L + 30, T + 26);
      break;
    case "log":
      shadow(g, cx, 10, w, 14);
      g.fillStyle(0x5d432d).fillRoundedRect(L + 2, -8, w - 4, 18, 9);
      g.fillStyle(0xa47a52).fillEllipse(L + w - 6, 1, 12, 18);
      g.lineStyle(2, 0x3f2d1f, 0.6).lineBetween(L + 10, -2, L + w - 18, -2);
      break;
    case "slicktrunk": {
      // A fallen trunk over a drop, dark and wet.
      g.fillStyle(0x0e120c, 0.5).fillRect(L, 6, w, 16);
      g.fillStyle(0x4b3a2a).fillRoundedRect(L, -10, w, 20, 10);
      g.fillStyle(0x6f8a5a, 0.7).fillEllipse(L + w * 0.3, -6, 30, 6).fillEllipse(L + w * 0.7, -4, 24, 5);
      g.lineStyle(2, 0xd8e3d0, 0.35).lineBetween(L + 6, -6, L + w - 10, -6);
      break;
    }
    case "potmark":
      g.lineStyle(3, 0x6a4a30, 0.65).beginPath().arc(0, 0, 14, Math.PI * 0.1, Math.PI * 0.9).strokePath();
      g.lineStyle(2, 0x6a4a30, 0.5).lineBetween(-16, 8, 16, 8);
      break;
    case "boulder":
      shadow(g, 0, 14, 46);
      g.fillStyle(0x6f6f63).fillEllipse(0, -2, 42, 34);
      g.fillStyle(0x8e8d7d).fillEllipse(-6, -8, 26, 18);
      break;
    case "canoe": {
      g.fillStyle(0x0d1a1a, 0.3).fillEllipse(cx, 10, w, 22);
      g.fillStyle(0x5a3b26).fillEllipse(cx, 0, w - 6, 26);
      g.fillStyle(0x8a5c3a).fillEllipse(cx, -3, w - 16, 16);
      g.lineStyle(3, 0x3b2618).lineBetween(cx - 18, -3, cx + 18, -3);
      g.lineStyle(3, 0xc8b07a).lineBetween(cx + w / 4, -26, cx + w / 4 - 10, 10);
      break;
    }
    case "post":
      shadow(g, 0, 12, 18);
      g.fillStyle(0x5d432d).fillRect(-5, -30, 10, 42);
      g.fillStyle(0x8b6a48).fillRect(-5, -30, 10, 5);
      break;
    case "rope":
      g.lineStyle(3, 0xc9b27a).beginPath().moveTo(-14, -6).lineTo(-4, 6).lineTo(6, -4).lineTo(14, 8).strokePath();
      g.lineStyle(3, 0xc9b27a).strokeCircle(2, 2, 8);
      break;
    case "ropes":
      for (let i = 0; i < 3; i++) g.lineStyle(3, i ? 0xb39a66 : 0xd2bb85).strokeEllipse(0, 4 - i * 4, 30 - i * 6, 14 - i * 3);
      break;
    case "vines":
      for (let i = -2; i <= 2; i++) g.lineStyle(3, 0x4f6b3a).lineBetween(i * 6, -70, i * 7 + 3, 14);
      g.fillStyle(0x5f7f45).fillCircle(-8, -30, 4).fillCircle(9, -10, 4).fillCircle(0, -50, 4);
      break;
    case "stone":
      g.fillStyle(0x0b1918, 0.35).fillEllipse(0, 8, 34, 14);
      g.fillStyle(p.loose ? 0x8a8a74 : 0xa3a28b).fillEllipse(0, 0, 32, 20);
      g.fillStyle(0xc6c5ac, 0.6).fillEllipse(-5, -3, 16, 8);
      break;
    case "clay":
      g.fillStyle(0x9a5e3c, 0.8).fillEllipse(0, -6, 18, 10);
      g.fillStyle(0xc28a5c, 0.6).fillEllipse(4, 0, 10, 6);
      break;
    case "bundle":
      shadow(g, 0, 10, 34);
      for (let i = -3; i <= 3; i++) g.lineStyle(4, i % 2 ? 0x7a5634 : 0x94693f).lineBetween(-18, i * 3, 18, i * 3 - 2);
      g.lineStyle(3, 0xd2bb85).lineBetween(-6, -12, -6, 12).lineBetween(8, -12, 8, 12);
      break;
    case "silkcotton": {
      // A silk-cotton tree: grey trunk with buttress roots, a high canopy.
      shadow(g, cx, by - 10, w + 30, 34, 0.32);
      g.fillStyle(0x8a8577).fillTriangle(cx - 40, by - 6, cx - 8, by - 50, cx - 6, by - 6);
      g.fillStyle(0x8a8577).fillTriangle(cx + 40, by - 6, cx + 8, by - 50, cx + 6, by - 6);
      g.fillStyle(0x9c978a).fillRect(cx - 14, T - 30, 28, by - T + 26);
      g.lineStyle(2, 0x6d695d, 0.6).lineBetween(cx - 6, T - 20, cx - 4, by - 10).lineBetween(cx + 7, T - 10, cx + 5, by - 14);
      canopy(g, cx, T - 30, w * 0.7, h * 0.45, p.at[0] * 7 + p.at[1]);
      break;
    }
    case "greattree": {
      // The tallest tree, where Anansi hides: a vast trunk and roots.
      shadow(g, cx, by - 8, w + 40, 40, 0.34);
      for (const dx of [-0.42, -0.2, 0.22, 0.44])
        g.fillStyle(0x6c5a45).fillTriangle(cx + dx * w * 1.2, by, cx + dx * w * 0.35, by - h * 0.6, cx + dx * w * 0.1, by);
      g.fillStyle(0x7d6950).fillRoundedRect(cx - w * 0.22, T - 40, w * 0.44, by - T + 34, 18);
      g.lineStyle(3, 0x5a4a37, 0.7);
      for (let i = -2; i <= 2; i++) g.lineBetween(cx + i * w * 0.07, T - 30, cx + i * w * 0.08, by - 10);
      canopy(g, cx, T - 50, w * 0.65, h * 0.4, 99);
      break;
    }
    case "overhang": {
      shadow(g, cx, by - 4, w + 10, 30, 0.3);
      g.fillStyle(0x5f5d52).fillRoundedRect(L - 6, T - 20, w + 12, h * 0.8, 22);
      g.fillStyle(0x77756a).fillRoundedRect(L, T - 26, w, h * 0.45, 20);
      g.fillStyle(0x23241e, 0.75).fillEllipse(cx, by - 10, w * 0.7, 34);
      break;
    }
    case "roots":
      g.lineStyle(7, 0x5d462f);
      g.beginPath().moveTo(L, 8).lineTo(L + w * 0.3, -6).lineTo(L + w * 0.6, 4).lineTo(L + w, -4).strokePath();
      g.lineStyle(4, 0x7b5f40).lineBetween(L + w * 0.3, -6, L + w * 0.35, 14);
      break;
    case "stool":
      shadow(g, 0, 12, 26);
      g.fillStyle(0x6a4b33).fillRect(-12, -2, 4, 14).fillRect(8, -2, 4, 14);
      g.fillStyle(0x9a7350).fillEllipse(0, -4, 30, 12);
      break;
    case "wheel":
      shadow(g, 0, 10, 34);
      g.fillStyle(0x6a4b33).fillEllipse(0, 2, 32, 16);
      g.fillStyle(0xa86f4c).fillEllipse(0, -6, 18, 14);
      break;
    case "basket":
      shadow(g, 0, 12, 30);
      g.fillStyle(0xb08a52).fillRoundedRect(-14, -12, 28, 24, 6);
      g.lineStyle(2, 0x7a5a32);
      for (let y = -8; y <= 8; y += 5) g.lineBetween(-12, y, 12, y);
      break;
    // ── The Palace Beneath the Tide ──────────────────────────────────────
    case "boat": {
      shadow(g, cx, 10, w, 20, 0.3);
      if (p.upturned) {
        g.fillStyle(0x5d4632).fillEllipse(cx, -2, w - 4, 28);
        g.lineStyle(2, 0x3b2a1c, 0.7).lineBetween(L + 10, -2, L + w - 10, -2);
      } else {
        g.fillStyle(0x6a4a30).fillEllipse(cx, 0, w - 4, 30);
        g.fillStyle(0x9a7048).fillEllipse(cx, -3, w - 16, 18);
        g.lineStyle(3, 0x3b2a1c).lineBetween(cx - 14, -3, cx + 14, -3);
      }
      break;
    }
    case "knife":
      g.fillStyle(0x6a4b33).fillRoundedRect(-12, -2, 10, 5, 2);
      g.fillStyle(0xc9cdd0).fillTriangle(-2, -3, 14, 0, -2, 3);
      break;
    case "nets":
      g.lineStyle(1.5, 0xc9b98a, 0.85);
      for (let i = 0; i < 6; i++) g.lineBetween(L + 4 + i * 12, -12, L + 10 + i * 12, 12).lineBetween(L + 10 + i * 12, -12, L + 4 + i * 12, 12);
      g.fillStyle(0xd9a03a).fillCircle(L + 8, -12, 3).fillCircle(L + w - 8, -10, 3);
      break;
    case "waterline":
      g.lineStyle(3, 0x2f5f78, 0.8).lineBetween(L, -10, L + w, -10);
      g.lineStyle(1, 0xefe6d2, 0.6).lineBetween(L, -6, L + w, -6);
      break;
    case "fishline":
      g.lineStyle(2, 0xe8e2d0, 0.9).beginPath().moveTo(L + 4, 6).lineTo(L + 14, -6).lineTo(L + 24, 8).lineTo(L + w - 6, -4).strokePath();
      g.lineStyle(2, 0xe8e2d0, 0.9).strokeCircle(L + 18, 2, 7);
      break;
    case "shell":
      g.fillStyle(0xf0dcc8).fillEllipse(0, 0, 20, 16);
      g.lineStyle(1.5, 0xc89a7a, 0.9);
      for (let i = -2; i <= 2; i++) g.lineBetween(0, 8, i * 4, -6);
      break;
    case "greenroad":
      g.fillStyle(0x6fbf9a, 0.25).fillRoundedRect(L + 6, T, w - 12, h, 18);
      g.lineStyle(2, 0xbfe8cf, 0.5).lineBetween(cx, T + 6, cx, T + h - 6);
      break;
    case "bells":
      g.lineStyle(2, 0x8a6a3a, 0.9).lineBetween(0, T - 20, 0, T + h - 10);
      for (let i = 0; i < (p.h ?? 4); i++) g.fillStyle(0xb88a3a).fillTriangle(-7, T + i * TILE + 10, 7, T + i * TILE + 10, 0, T + i * TILE - 4);
      break;
    case "bubbles":
      for (let i = 0; i < 10; i++) g.lineStyle(1.5, 0xd8f0f0, 0.7).strokeCircle(L + 10 + ((i * 13) % (w - 16)), T + h - i * (h / 10), 2 + (i % 3) * 2);
      break;
    case "tunnel":
      g.fillStyle(0xbfe8f0, 0.25).fillEllipse(cx, T + h / 2, w, h);
      g.fillStyle(0xf0fbff, 0.25).fillEllipse(cx, T + h / 2, w * 0.6, h * 0.6);
      break;
    case "pillar":
      shadow(g, 0, 14, 30);
      g.fillStyle(0xa8443a).fillRect(-10, -56, 20, 70);
      g.fillStyle(0xd7b25a).fillRect(-12, -60, 24, 6).fillRect(-12, 10, 24, 5);
      g.fillStyle(0xffffff, 0.15).fillRect(-6, -54, 4, 62);
      break;
    case "lantern":
      g.lineStyle(2, 0x5a3e28).lineBetween(0, -40, 0, -26);
      g.fillStyle(0xe8a04d, 0.95).fillEllipse(0, -14, 18, 24);
      g.lineStyle(1.5, 0x8a3a2a).strokeEllipse(0, -14, 18, 24);
      g.fillStyle(0xfff0c0, 0.25).fillCircle(0, -14, 26);
      break;
    case "window": {
      const sky = { spring: 0xb9d9a8, summer: 0xf0d27a, autumn: 0xd9864a, winter: 0xdfe8ee }[p.season] ?? 0xd8e8f0;
      g.fillStyle(0x5a1e18).fillRect(L - 6, T - 6, TILE + 12, TILE + 4);
      g.fillStyle(sky).fillRect(L - 2, T - 2, TILE + 4, TILE - 4);
      g.lineStyle(2, 0x5a1e18).lineBetween(L + TILE / 2, T - 2, L + TILE / 2, T + TILE - 6).lineBetween(L - 2, T + TILE / 2 - 4, L + TILE + 2, T + TILE / 2 - 4);
      if (p.season === "winter") g.fillStyle(0xffffff).fillCircle(L + 8, T + 6, 2).fillCircle(L + 26, T + 14, 2);
      if (p.season === "spring") g.lineStyle(1, 0x5a7a9a).lineBetween(L + 6, T + 2, L + 4, T + 10).lineBetween(L + 22, T + 4, L + 20, T + 12);
      if (p.season === "autumn") g.fillStyle(0xb8402c).fillEllipse(L + 10, T + 22, 6, 4);
      break;
    }
    case "lowtable":
      shadow(g, cx, 14, w + 6, 16);
      g.fillStyle(0x3e1512).fillRoundedRect(L + 2, -12, w - 4, 26, 4);
      g.fillStyle(0x7b2e29).fillRoundedRect(L + 4, -14, w - 8, 22, 4);
      break;
    case "bowls":
      for (let i = 0; i < (p.w ?? 1); i++) {
        g.fillStyle(0x2a1a14).fillEllipse(L + 20 + i * TILE, 2, 22, 10);
        g.fillStyle(0xf0e6d0).fillEllipse(L + 20 + i * TILE, 0, 18, 7);
        g.lineStyle(1.2, 0xf4f2e6).lineBetween(L + 14 + i * TILE, 4, L + 10 + i * TILE, 14).lineBetween(L + 26 + i * TILE, 4, L + 30 + i * TILE, 12);
      }
      break;
    case "beam":
      g.fillStyle(0x7a5634).fillRoundedRect(L, -6, w, 12, 4);
      break;
    case "dial": {
      shadow(g, cx, by - 6, w, 20);
      for (let i = 0; i < 4; i++) {
        g.fillStyle([0xa3a094, 0xb5b2a4, 0xc7c4b6, 0xd9d6c8][i]).fillCircle(cx, T + h / 2, 34 - i * 8);
        g.lineStyle(1.5, 0x6a6658, 0.7).strokeCircle(cx, T + h / 2, 34 - i * 8);
      }
      const glyphs = [0x9ac08a, 0xe0b84a, 0xc8743a, 0xe8eef2];
      glyphs.forEach((c, i) => g.fillStyle(c).fillCircle(cx + Math.cos(i * 1.57) * 26, T + h / 2 + Math.sin(i * 1.57) * 26, 4));
      break;
    }
    case "blossom":
      g.lineStyle(3, 0x6a4b33).lineBetween(0, 12, 0, -22);
      for (let i = 0; i < 7; i++) g.fillStyle(i % 2 ? 0xf2b8c6 : 0xf7d6de).fillCircle(Math.cos(i) * 14, -26 + Math.sin(i * 1.7) * 8, 6);
      break;
    case "lectern":
      shadow(g, 0, 14, 26);
      g.fillStyle(0x5a1e18).fillRect(-4, -8, 8, 22);
      g.fillStyle(0x7b2e29).fillRect(-16, -18, 32, 12);
      g.fillStyle(0xefe6d2).fillRect(-12, -17, 24, 9);
      g.lineStyle(1, 0x2f5f78).lineBetween(-10, -12, 10, -14);
      break;
    case "years":
      for (let i = 0; i < 14; i++) {
        const x = L + 20 + ((i * 53) % (w - 40)),
          y = T + 10 + ((i * 29) % (h - 20));
        g.fillStyle(0xd8e8f0, 0.5).fillEllipse(x, y, 16, 6);
        g.fillStyle(0xd8e8f0, 0.5).fillTriangle(x + 8, y, x + 13, y - 4, x + 13, y + 4);
      }
      break;
    case "bottles":
      g.fillStyle(0x4e3020).fillRect(L, -16, w, 30);
      for (let i = 0; i < (p.w ?? 1) * 2; i++) {
        const x = L + 10 + i * (TILE / 2);
        g.fillStyle([0x7fb0c4, 0x9fd0c8, 0x6a9ab0][i % 3], 0.9).fillRoundedRect(x - 5, -12, 10, 18, 3);
        g.fillStyle(0xefe6d2).fillRect(x - 4, -4, 8, 4);
      }
      if (p.jammed) g.lineStyle(3, 0x9a3a2a).lineBetween(L + w - 30, -18, L + w - 10, 12);
      break;
    case "desk":
      shadow(g, cx, 14, w, 14);
      g.fillStyle(0x5a3a28).fillRect(L + 2, -14, w - 4, 26);
      g.fillStyle(0x7fb0c4, 0.9).fillRoundedRect(cx - 6, -22, 10, 16, 3);
      break;
    case "screen":
      g.fillStyle(0xefe6d2).fillRect(L, -30, w, 40);
      g.lineStyle(2, 0x3e1512);
      for (let i = 0; i <= (p.w ?? 1); i++) g.lineBetween(L + i * TILE, -30, L + i * TILE, 10);
      g.lineStyle(1.5, 0x6a8a5a, 0.7).lineBetween(L + 10, 0, L + 30, -20).lineBetween(L + 50, 4, L + 80, -14);
      break;
    case "chartstone":
      g.fillStyle(0xd8d4c6).fillEllipse(0, 0, 30, 18);
      g.lineStyle(2, 0x2f5f78).beginPath().moveTo(-10, 2).lineTo(-2, -4).lineTo(6, 3).lineTo(12, -2).strokePath();
      break;
    case "boxstand":
      shadow(g, 0, 14, 30);
      g.fillStyle(0x3e1512).fillRect(-14, -4, 28, 18);
      g.fillStyle(0x1a1412).fillRoundedRect(-11, -22, 22, 18, 3);
      g.lineStyle(2, 0xd7b25a).strokeRoundedRect(-11, -22, 22, 18, 3);
      g.lineStyle(2, 0xb8402c).lineBetween(-11, -13, 11, -13).lineBetween(0, -22, 0, -4);
      break;
    case "gaterock":
      shadow(g, cx, 14, w, 20);
      g.fillStyle(0x5e6a68).fillRoundedRect(L, -24, w, 40, 16);
      g.fillStyle(0x7e8784).fillRoundedRect(L + 8, -28, w - 30, 18, 10);
      break;
    case "surface":
      g.fillStyle(0xe8f4f0, 0.3).fillRect(L, T, w, 8);
      g.lineStyle(2, 0xe8f4f0, 0.5).lineBetween(L, T + 14, L + w, T + 14);
      break;
    case "house":
      shadow(g, cx, by - 6, w + 6, 22);
      g.fillStyle(0xcfc2a2).fillRect(L + 4, T + 8, w - 8, h - 14);
      g.fillStyle(p.roof === "slate" ? 0x4a5560 : 0x6a5a3e).fillTriangle(L - 6, T + 12, L + w + 6, T + 12, cx, T - 26);
      g.fillStyle(0x3e2e22).fillRect(cx - 8, by - 34, 16, 28);
      break;
    case "turninggate":
      g.fillStyle(0xa8443a).fillRect(-8, T - 10, 16, h + 10);
      for (let i = 0; i < 4; i++) g.lineStyle(3, 0xd7b25a).lineBetween(-20, T + i * (h / 4), 20, T + i * (h / 4) + 10);
      break;
    case "weed":
      for (let i = 0; i < 6; i++) g.lineStyle(3, 0x4a7a4a).beginPath().moveTo(L + 8 + i * 12, 14).lineTo(L + 4 + i * 12, -6).lineTo(L + 10 + i * 12, -22).strokePath();
      break;
    case "niche":
      g.fillStyle(0x23241e, 0.75).fillRoundedRect(L, T, w, h, 10);
      break;
    default: {
      shadow(g, 0, 12, 34);
      g.fillStyle(0xa17b4e).fillRect(-15, -20, 30, 30);
      g.lineStyle(2, 0x66523b).strokeRect(-15, -20, 30, 30);
      g.lineBetween(-14, -19, 14, 9).lineBetween(14, -19, -14, 9);
    }
  }
  return g;
}

/** Each person has a look: skin, cloth, a headwrap or cap, something carried. */
const LOOKS = {
  potter: { cloth: 0x7c8fa0, wrap: 0xc1a05a, skin: 0x7a4e35, carry: "clay" },
  ferryman: { cloth: 0x5b6b4a, wrap: null, cap: 0x3a3226, skin: 0x5e3b28, carry: "pole" },
  woodboy: { cloth: 0xa0583c, wrap: null, skin: 0x6b432d, carry: "bundle", small: true },
  elder: { cloth: 0xe9dcc0, wrap: 0xe9dcc0, skin: 0x5a3826, carry: "staff", stripe: 0x9e4429 },
  villager: { cloth: 0xa77a66, wrap: 0x536375, skin: 0x6e4630 },
  child: { cloth: 0xc1a05a, wrap: null, skin: 0x744a32, small: true },
  attendant: { cloth: 0x2f6a7a, wrap: 0xd7b25a, skin: 0x9ab8c0, carry: "staff" },
  archivist: { cloth: 0x4a5a6a, wrap: 0xefe6d2, skin: 0x9ab8c0 },
  worker: { cloth: 0x6a5a4a, wrap: 0xefe6d2, skin: 0xb88a64 },
};

export function drawPerson(scene, kind = "villager", { tint, id = "" } = {}) {
  const g = scene.add.graphics();
  if (kind === "turtle") {
    g.fillStyle(0x1e2618, 0.3).fillEllipse(0, 6, 40, 14);
    g.fillStyle(0x7a9a6a).fillEllipse(-16, 2, 12, 8).fillEllipse(16, 2, 12, 8).fillEllipse(-12, -14, 10, 7).fillEllipse(12, -14, 10, 7);
    g.fillStyle(0x6a8a5a).fillCircle(0, -20, 8);
    g.fillStyle(0x4a6a42).fillEllipse(0, -4, 34, 28);
    g.lineStyle(1.5, 0xb9c98a, 0.8).strokeEllipse(0, -4, 22, 16).lineBetween(0, -18, 0, 10).lineBetween(-16, -4, 16, -4);
    g.fillStyle(0x1b1611).fillCircle(-3, -23, 1.5).fillCircle(3, -23, 1.5);
    return g;
  }
  if (kind === "crab") {
    g.fillStyle(0xc8583a).fillEllipse(0, 0, 18, 12);
    g.lineStyle(2, 0xc8583a).lineBetween(-8, 2, -14, 8).lineBetween(8, 2, 14, 8).lineBetween(-8, -2, -14, -8).lineBetween(8, -2, 14, -8);
    return g;
  }
  if (kind === "fish") {
    g.fillStyle(0xd8e4ea, 0.85).fillEllipse(0, -20, 22, 9);
    g.fillStyle(0xd8e4ea, 0.85).fillTriangle(10, -20, 18, -26, 18, -14);
    g.fillStyle(0x1b1611).fillCircle(-6, -21, 1.3);
    return g;
  }
  if (kind === "gull") {
    g.fillStyle(0x233224, 0.25).fillEllipse(0, 8, 20, 6);
    g.fillStyle(0xf0f0ea).fillEllipse(0, -2, 20, 12).fillCircle(8, -8, 5);
    g.fillStyle(0x9aa0a6).fillEllipse(-4, -4, 14, 6);
    g.fillStyle(0xe0a33a).fillTriangle(12, -9, 18, -8, 12, -6);
    return g;
  }
  if (kind === "hen" || kind === "bird") {
    g.fillStyle(0x233224, 0.3).fillEllipse(0, 8, 22, 8);
    const body = kind === "bird" ? 0x3f4c5a : 0xe1c89c;
    g.fillStyle(body).fillEllipse(0, -2, kind === "bird" ? 16 : 22, kind === "bird" ? 12 : 17).fillCircle(7, -10, kind === "bird" ? 5 : 6);
    g.fillStyle(kind === "bird" ? 0xe0a33a : 0xa35236).fillTriangle(10, -14, 16, -12, 11, -9);
    return g;
  }
  const look = { ...(LOOKS[kind] ?? LOOKS.villager) };
  if (tint) look.cloth = { indigo: 0x4c5f86, gold: 0xc9a14a, green: 0x5d7b4b, red: 0xa85c43 }[tint] ?? look.cloth;
  // Small, deterministic variation so a crowd is not a row of twins.
  const v = [...id].reduce((n, c) => n + c.charCodeAt(0), 0);
  const s = look.small ? 0.82 : 1;
  g.fillStyle(0x233224, 0.3).fillEllipse(0, 4, 28 * s, 12 * s);
  g.lineStyle(6 * s, 0x3f2c20).lineBetween(-5 * s, -10 * s, -6 * s, 2).lineBetween(5 * s, -10 * s, 6 * s, 2);
  g.fillStyle(look.cloth).fillRoundedRect(-12 * s, -38 * s, 24 * s, 30 * s, 6 * s);
  if (look.stripe) g.fillStyle(look.stripe).fillRect(-12 * s, -24 * s, 24 * s, 4 * s);
  if (v % 3 === 0 && !look.stripe) g.fillStyle(0xffffff, 0.18).fillRect(-12 * s, -30 * s, 24 * s, 3 * s);
  g.lineStyle(5 * s, look.skin).lineBetween(-12 * s, -32 * s, -15 * s, -18 * s).lineBetween(12 * s, -32 * s, 15 * s, -18 * s);
  g.fillStyle(look.skin).fillCircle(0, -46 * s, 9 * s);
  if (look.wrap) g.fillStyle(look.wrap).fillEllipse(0, -53 * s, 20 * s, 10 * s);
  else if (look.cap) g.fillStyle(look.cap).fillEllipse(0, -52 * s, 18 * s, 8 * s);
  else g.fillStyle(0x221b14).fillEllipse(0, -52 * s, 17 * s, 9 * s);
  if (look.carry === "staff") g.lineStyle(3, 0x6a4b33).lineBetween(16, -48, 18, 4);
  if (look.carry === "pole") g.lineStyle(3, 0xc8b07a).lineBetween(18, -66, 14, 4);
  if (look.carry === "bundle") g.fillStyle(0x7a5634).fillRoundedRect(-14 * s, -64 * s, 28 * s, 9 * s, 4);
  if (look.carry === "clay") g.fillStyle(0xa86f4c).fillEllipse(16, -20, 10, 12);
  return g;
}
