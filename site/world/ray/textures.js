// Walls, floors, ceilings and skies for each tradition, painted in code from
// a palette. Nothing is a committed image: the same seed paints the same
// texture on every machine, and scripts/art-check.mjs checks every one.
//
// To use commissioned art instead, see docs/ART-SPEC.md: a PNG with the same
// name and size replaces the painted texture without touching this file.
import { texture, fill, fbm, noise2, rect, ellipse, polygon, line, plot, rgb, mix, shade, random } from "./paint.js";
import { hash32 } from "../../engine/rng.js";

export const WALL = 128;
/** Walls are painted taller than wide: a 1 m face, WALL_H (2.5 m) high. */
export const WALL_TALL = 256;
export const FLOOR = 64;

/** Colours of each tradition. Every painted thing in a tale draws from these. */
export const PALETTES = {
  // Fante country: laterite earth, thatch, forest greens, kente red and gold.
  wisdom: {
    earth: "#93573a", path: "#b07a4f", grass: "#5f7d3c", grassDark: "#3f5a2a", sand: "#c9a877", mud: "#5e4130",
    wall: "#a8643e", wallDark: "#6e3a25", plaster: "#c58b5e", timber: "#5a3a24", roof: "#b08c50", roofDark: "#7a5a2e",
    stone: "#8c7c6a", leaf: "#3c6634", leafLight: "#73984a", bark: "#6a4a32", water: "#3d6e78", waterLight: "#7fb0b0",
    wood: "#7a5030", cloth: "#b8402c", cloth2: "#dcaa3c", cloth3: "#2e6a46", accent: "#e0ba69", rug: "#8c3a2a",
    skin: "#6a4130", skinLight: "#8a5a3e", hair: "#1e1612", ink: "#22160f",
  },
  // The Tango coast: vermilion lacquer, grey tile, pine, sea and paper.
  tide: {
    earth: "#8a8270", path: "#a89c82", grass: "#5d7e62", grassDark: "#3d5a48", sand: "#d4c6a4", mud: "#4e4a40",
    wall: "#b2382e", wallDark: "#4a2a26", plaster: "#e8dcc4", timber: "#3e2a22", roof: "#4a4e58", roofDark: "#2c3038",
    stone: "#94948c", leaf: "#2e5a4c", leafLight: "#5e8a6a", bark: "#4a3a30", water: "#2a6a8e", waterLight: "#7ec4d8",
    wood: "#6e4832", cloth: "#c84646", cloth2: "#465a96", cloth3: "#e2d2b4", accent: "#e8c45a", rug: "#7a4a3a",
    skin: "#e2b996", skinLight: "#f0ceae", hair: "#16141a", ink: "#1a1416",
  },
  // A German village in autumn: plaster and timber, slate, oak and beech.
  orchestra: {
    earth: "#6e5640", path: "#8e7458", grass: "#647638", grassDark: "#45542a", sand: "#b8a07a", mud: "#4a3a2a",
    wall: "#c8b896", wallDark: "#8a7a5e", plaster: "#d8cba8", timber: "#4a3020", roof: "#6a4636", roofDark: "#3e2a22",
    stone: "#7a766c", leaf: "#8a5a26", leafLight: "#c48a34", bark: "#4a3a2c", water: "#3e5e66", waterLight: "#86a8a8",
    wood: "#7a5434", cloth: "#7a3a28", cloth2: "#465a3a", cloth3: "#a48c64", accent: "#e8b450", rug: "#6a3a2e",
    skin: "#e6be9e", skinLight: "#f2d4b8", hair: "#5a3a22", ink: "#1e1610",
  },
  // Baghdad: ochre stucco, lapis tile, palms, brass and dyed wool.
  olives: {
    earth: "#b08a5e", path: "#c8a478", grass: "#7a8046", grassDark: "#565a30", sand: "#d8bc8a", mud: "#6a5236",
    wall: "#d2b078", wallDark: "#94703e", plaster: "#e4cc9a", timber: "#5a3c26", roof: "#a07a4e", roofDark: "#6a5034",
    stone: "#bca88a", leaf: "#4e6e3c", leafLight: "#86a24e", bark: "#6e5236", water: "#3a7a8a", waterLight: "#8ac8c8",
    wood: "#7a5032", cloth: "#a83838", cloth2: "#2a4a96", cloth3: "#e8c878", accent: "#d8a83c", rug: "#9a2e2e",
    skin: "#b07c54", skinLight: "#c8946a", hair: "#1a120c", ink: "#1e140c",
  },
};
export const paletteOf = (tale) => PALETTES[tale] ?? PALETTES.wisdom;

const C = (pal, key) => rgb(pal[key]);
const seedOf = (...parts) => hash32(parts.join(":"));

// ── Walls ─────────────────────────────────────────────────────────────────
function mudWall(pal, seed) {
  const n = fbm(seed, WALL, 4, 4);
  const t = fill(texture(WALL, WALL_TALL), (x, y) => {
    const v = n(x, y);
    // Hand-smoothed render: long horizontal strokes, darker at the foot.
    const stroke = Math.sin(y * 0.35 + n(x * 0.5, y * 3) * 5) * 0.05;
    const foot = y > WALL_TALL * 0.88 ? 0.78 : 1;
    return shade(mix(C(pal, "wall"), C(pal, "plaster"), v * 0.6 + stroke), (0.82 + v * 0.3) * foot);
  });
  const r = random(seed);
  for (let i = 0; i < 4; i++) {
    let x = r() * WALL,
      y = r() * WALL_TALL * 0.8;
    for (let k = 0; k < 14; k++) {
      const nx = x + (r() - 0.5) * 8,
        ny = y + r() * 6;
      line(t, x, y, nx, ny, 1, C(pal, "wallDark"), 0.7);
      x = nx;
      y = ny;
    }
  }
  return t;
}

function lacquerWall(pal, seed) {
  // Red posts and rails, paper or plaster panels between.
  const n = fbm(seed, WALL, 3, 4);
  return fill(texture(WALL, WALL_TALL), (x, y) => {
    const post = x < 14 || x > WALL - 14;
    const rail = (y > 20 && y < 30) || (y > WALL_TALL - 26 && y < WALL_TALL - 16);
    const grid = !post && !rail && y > 30 && y < WALL_TALL - 26 && (x % 28 < 2 || y % 24 < 2);
    const v = n(x, y);
    if (post || rail) return shade(C(pal, "wall"), 0.8 + v * 0.35 - (post && (x < 3 || x > WALL - 4) ? 0.25 : 0));
    if (grid) return C(pal, "timber");
    if (y >= WALL_TALL - 16) return shade(C(pal, "stone"), 0.7 + v * 0.3);
    return shade(C(pal, "plaster"), 0.88 + v * 0.14);
  });
}

function timberWall(pal, seed) {
  // Half-timbering: plaster panels between dark oak beams and braces.
  const n = fbm(seed, WALL, 4, 4);
  const t = fill(texture(WALL, WALL_TALL), (x, y) => shade(C(pal, "plaster"), 0.78 + n(x, y) * 0.3));
  const beam = (x1, y1, x2, y2) => line(t, x1, y1, x2, y2, 9, shade(C(pal, "timber"), 1.05));
  beam(4, 0, 4, WALL_TALL);
  beam(WALL - 4, 0, WALL - 4, WALL_TALL);
  beam(0, 6, WALL, 6);
  beam(0, WALL_TALL * 0.55, WALL, WALL_TALL * 0.55);
  beam(8, WALL_TALL * 0.55, WALL / 2, 8);
  beam(WALL - 8, WALL_TALL * 0.55, WALL / 2, 8);
  rect(t, 0, WALL_TALL - 18, WALL, 18, shade(C(pal, "stone"), 0.85));
  for (let x = 0; x < WALL; x += 16) rect(t, x, WALL_TALL - 18, 1, 18, shade(C(pal, "stone"), 0.6));
  return t;
}

function stuccoWall(pal, seed) {
  // Ochre stucco with a band of lapis tiles and a shallow arch.
  const n = fbm(seed, WALL, 4, 4);
  const t = fill(texture(WALL, WALL_TALL), (x, y) => {
    const v = n(x, y);
    if (y > 16 && y < 30) {
      const tile = (Math.floor(x / 14) + Math.floor(y / 7)) % 2;
      return shade(tile ? C(pal, "cloth2") : C(pal, "plaster"), 0.85 + v * 0.2);
    }
    return shade(C(pal, "wall"), 0.8 + v * 0.32);
  });
  polygon(
    t,
    Array.from({ length: 18 }, (_, i) => {
      const a = Math.PI + (i / 17) * Math.PI;
      return [WALL / 2 + Math.cos(a) * 30, 130 + Math.sin(a) * 30];
    }).concat([[WALL / 2 + 30, WALL_TALL - 10], [WALL / 2 - 30, WALL_TALL - 10]]),
    shade(C(pal, "wallDark"), 0.9),
  );
  return t;
}

function thatch(pal, seed) {
  const r = random(seed);
  const t = fill(texture(WALL, WALL_TALL), () => C(pal, "roofDark"));
  for (let i = 0; i < 1800; i++) {
    const x = r() * WALL,
      y = r() * WALL_TALL;
    line(t, x, y, x + (r() - 0.5) * 4, y + 10 + r() * 14, 1.4, shade(C(pal, "roof"), 0.75 + r() * 0.45));
  }
  return t;
}

function roofTiles(pal, seed) {
  const n = fbm(seed, WALL, 3, 4);
  return fill(texture(WALL, WALL_TALL), (x, y) => {
    const row = Math.floor(y / 12);
    const off = row % 2 ? 8 : 0;
    const edge = (x + off) % 16 < 2 || y % 12 > 9;
    return shade(edge ? C(pal, "roofDark") : C(pal, "roof"), 0.8 + n(x, y) * 0.3 + (y % 12) * 0.012);
  });
}

function forest(pal, seed) {
  // A wall of trees: trunks in the dark, leaves crowding the top.
  const r = random(seed);
  const leafN = fbm(seed + 1, WALL, 4, 4);
  const t = fill(texture(WALL, WALL_TALL), (x, y) => shade(C(pal, "grassDark"), 0.35 + (y / WALL) * 0.2));
  for (let i = 0; i < 6; i++) {
    const x = r() * WALL,
      w = 6 + r() * 12;
    rect(t, x - w / 2, WALL_TALL * 0.3, w, WALL_TALL * 0.7, shade(C(pal, "bark"), 0.6 + r() * 0.4));
    rect(t, x - w / 2, WALL_TALL * 0.3, 2, WALL_TALL * 0.7, shade(C(pal, "bark"), 0.4));
  }
  for (let y = 0; y < WALL_TALL * 0.78; y++)
    for (let x = 0; x < WALL; x++) {
      const v = leafN(x, y);
      const edge = WALL_TALL * (0.45 + 0.3 * leafN(x * 0.3, 7));
      if (y < edge && v > 0.38) plot(t, x, y, mix(C(pal, "leaf"), C(pal, "leafLight"), Math.max(0, (v - 0.45) * 2.4)));
    }
  return t;
}

function hedge(pal, seed) {
  const n = fbm(seed, WALL, 5, 4);
  return fill(texture(WALL, WALL_TALL), (x, y) => {
    const v = n(x, y);
    return v > 0.55 ? mix(C(pal, "leaf"), C(pal, "leafLight"), (v - 0.55) * 3) : shade(C(pal, "leaf"), 0.45 + v * 0.6);
  });
}

function bark(pal, seed) {
  const n = fbm(seed, WALL, 4, 4);
  return fill(texture(WALL, WALL_TALL), (x, y) => {
    const groove = Math.abs(Math.sin(x * 0.42 + n(x * 0.2, y * 0.05) * 6));
    return shade(C(pal, "bark"), 0.55 + groove * 0.4 + n(x, y) * 0.2);
  });
}

function rockFace(pal, seed) {
  const n = fbm(seed, WALL, 5, 4);
  return fill(texture(WALL, WALL_TALL), (x, y) => {
    const v = n(x, y);
    const crack = Math.abs(v - 0.5) < 0.012;
    return crack ? shade(C(pal, "stone"), 0.4) : shade(mix(C(pal, "stone"), C(pal, "earth"), v * 0.4), 0.6 + v * 0.55);
  });
}

function boards(pal, seed, vertical = true) {
  const n = fbm(seed, WALL, 3, 4);
  return fill(texture(WALL, WALL_TALL), (x, y) => {
    const u = vertical ? x : y,
      v = vertical ? y : x;
    const plank = Math.floor(u / 16);
    const seam = u % 16 < 2;
    const grain = Math.sin(v * 0.2 + plank * 3 + n(x, y) * 8) * 0.06;
    return shade(C(pal, "wood"), seam ? 0.5 : 0.82 + grain + n(x, y) * 0.2 + (plank % 3) * 0.04);
  });
}

function awningStall(pal, seed) {
  const t = boards(pal, seed, true);
  for (let y = 0; y < WALL_TALL * 0.3; y++)
    for (let x = 0; x < WALL; x++) plot(t, x, y, Math.floor(x / 16) % 2 ? C(pal, "cloth") : C(pal, "cloth3"));
  for (let x = 0; x < WALL; x += 16) ellipse(t, x + 8, WALL_TALL * 0.3, 8, 5, Math.floor(x / 16) % 2 ? C(pal, "cloth") : C(pal, "cloth3"));
  rect(t, 0, WALL_TALL * 0.55, WALL, 8, shade(C(pal, "wood"), 0.6));
  return t;
}

function voidWall() {
  return fill(texture(WALL, WALL_TALL), (x, y) => [14 + y * 0.08, 14 + y * 0.08, 18 + y * 0.1]);
}

/** Painters for each kind of wall, by tradition. */
const WALL_STYLE = {
  wisdom: { "#": mudWall, h: thatch },
  tide: { "#": lacquerWall, h: roofTiles },
  orchestra: { "#": timberWall, h: roofTiles },
  olives: { "#": stuccoWall, h: roofTiles },
};

/**
 * Props big enough to be buildings or tree trunks become solid walls in the
 * first-person world. Each names its wall painter.
 */
export const STRUCTURES = {
  hut: (pal, seed) => {
    const t = mudWall(pal, seed);
    const roof = thatch(pal, seed + 3);
    for (let y = 0; y < WALL_TALL * 0.24; y++) for (let x = 0; x < WALL; x++) t.data[y * WALL + x] = roof.data[y * WALL + x];
    for (let x = 0; x < WALL; x += 3) line(t, x, WALL_TALL * 0.24, x + 1, WALL_TALL * 0.24 + 4 + (x % 7), 1.2, C(pal, "roof"));
    return t;
  },
  house: (pal, seed) => lacquerWall(pal, seed),
  robberhouse: (pal, seed) => {
    const t = timberWall(pal, seed);
    rect(t, 44, 90, 40, 36, [255, 196, 92]);
    rect(t, 62, 90, 4, 36, C(pal, "timber"));
    rect(t, 44, 106, 40, 3, C(pal, "timber"));
    return t;
  },
  greattree: bark,
  silkcotton: bark,
  oak: bark,
  appletree: bark,
  overhang: rockFace,
  gaterock: rockFace,
  stall: awningStall,
};

export function paintWall(tale, kind) {
  const pal = paletteOf(tale);
  const seed = seedOf(tale, "wall", kind);
  if (STRUCTURES[kind]) return STRUCTURES[kind](pal, seed);
  if (kind === "T") return forest(pal, seed);
  if (kind === "b") return hedge(pal, seed);
  if (kind === " ") return voidWall();
  if (kind === "fence") return boards(pal, seed, true);
  return (WALL_STYLE[tale]?.[kind] ?? mudWall)(pal, seed);
}

// ── Floors ────────────────────────────────────────────────────────────────
const FLOOR_STYLE = {
  ".": (pal, n) => (x, y) => shade(C(pal, "earth"), 0.78 + n(x, y) * 0.38),
  ",": (pal, n) => (x, y) => {
    const v = n(x, y);
    return mix(C(pal, "grassDark"), C(pal, "grass"), v * 1.3) .map((c, i) => c + ((x * 7 + y * 13) % 5 === 0 ? 14 : 0) * (i === 1 ? 1 : 0.4));
  },
  '"': (pal, n) => (x, y) => {
    const blade = (x * 5 + Math.floor(y / 3) * 3) % 7 === 0;
    return shade(mix(C(pal, "grassDark"), C(pal, "grass"), n(x, y)), blade ? 1.25 : 0.85);
  },
  ":": (pal, n) => (x, y) => shade(mix(C(pal, "path"), C(pal, "earth"), n(x, y) * 0.5), 0.86 + n(x * 2, y * 2) * 0.22),
  _: (pal, n) => (x, y) => shade(C(pal, "sand"), 0.86 + n(x, y) * 0.2 + Math.sin((x + y) * 0.3) * 0.03),
  "~": (pal, n) => (x, y) => mix(C(pal, "water"), C(pal, "waterLight"), Math.max(0, n(x, y) - 0.45) * 1.8),
  w: (pal, n) => (x, y) => shade(mix(C(pal, "water"), C(pal, "waterLight"), Math.max(0, n(x, y) - 0.6) * 1.5), 0.62),
  "+": (pal, n) => (x, y) => shade(C(pal, "wood"), (y % 16 < 1 ? 0.5 : 0.85) + n(x, y) * 0.2 + Math.sin(x * 0.3 + Math.floor(y / 16) * 2) * 0.04),
  s: (pal, n) => (x, y) => {
    const ox = Math.floor(y / 16) % 2 ? 8 : 0;
    const seam = (x + ox) % 16 < 1 || y % 16 < 1;
    return shade(C(pal, "stone"), seam ? 0.55 : 0.8 + n(x, y) * 0.3);
  },
  r: (pal, n) => (x, y) => {
    const band = Math.floor(y / 8) % 4;
    const diamond = Math.abs((x % 16) - 8) + Math.abs((y % 16) - 8) < 5;
    const base = band === 0 ? C(pal, "cloth3") : C(pal, "rug");
    return shade(diamond ? C(pal, "cloth2") : base, 0.82 + n(x, y) * 0.16);
  },
  m: (pal, n) => (x, y) => shade(C(pal, "mud"), 0.7 + n(x, y) * 0.4 + (n(x * 3, y * 3) > 0.7 ? 0.25 : 0)),
};
/** Floors that ripple: their texture slides with time. */
export const FLOWING = new Set(["~", "w"]);

/** Floor overlays: props that are marks on the ground, not things standing on it. */
export const DECALS = {
  leaves: (pal, t, r) => {
    for (let i = 0; i < 16; i++) ellipse(t, r() * FLOOR, r() * FLOOR, 3, 1.6, r() > 0.5 ? C(pal, "leafLight") : C(pal, "accent"), { alpha: 0.9 });
  },
  potmark: (pal, t) => {
    for (let a = 0; a < 6.28; a += 0.05) plot(t, 32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18, C(pal, "wallDark"), 0.9);
  },
  potring: (pal, t) => {
    for (let a = 0; a < 6.28; a += 0.05) plot(t, 32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14, shade(C(pal, "earth"), 0.55), 0.9);
  },
  bootprints: (pal, t, r) => {
    for (let i = 0; i < 4; i++) ellipse(t, 16 + i * 10 + r() * 3, 26 + (i % 2) * 12, 3, 6, shade(C(pal, "earth"), 0.5), { alpha: 0.85 });
  },
  rutmark: (pal, t) => {
    rect(t, 0, 20, FLOOR, 4, shade(C(pal, "mud"), 0.7), 0.8);
    rect(t, 0, 42, FLOOR, 4, shade(C(pal, "mud"), 0.7), 0.8);
  },
  dustring: (pal, t) => {
    for (let a = 0; a < 6.28; a += 0.04) plot(t, 32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, C(pal, "sand"), 0.7);
  },
  rugline: (pal, t, _r, n) => {
    for (let y = 8; y < 56; y++) for (let x = 0; x < FLOOR; x++) plot(t, x, y, FLOOR_STYLE.r(pal, n)(x, y));
  },
  floorboards: (pal, t, _r, n) => {
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < FLOOR; x++) plot(t, x, y, shade(FLOOR_STYLE["+"](pal, n)(x, y), (x * 3 + y) % 23 === 0 ? 0.6 : 1));
  },
  waterline: (pal, t) => rect(t, 0, 28, FLOOR, 6, C(pal, "waterLight"), 0.6),
  greenroad: (pal, t, _r, n) => {
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < FLOOR; x++) plot(t, x, y, mix(C(pal, "leaf"), C(pal, "waterLight"), n(x, y) * 0.6), 0.75);
  },
  surface: (pal, t, _r, n) => {
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < FLOOR; x++) plot(t, x, y, mix(C(pal, "water"), [230, 240, 240], Math.max(0, n(x, y) - 0.5)), 0.7);
  },
  basin: (pal, t, _r, n) => {
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < FLOOR; x++) plot(t, x, y, FLOOR_STYLE["~"](pal, n)(x, y));
  },
  years: (pal, t, r) => {
    for (let i = 0; i < 30; i++) ellipse(t, r() * FLOOR, r() * FLOOR, 1.5, 1.5, C(pal, "accent"), { alpha: 0.6 });
  },
};

export function paintFloor(tale, ch, decal = null) {
  const pal = paletteOf(tale);
  const n = noise2(seedOf(tale, "floor", ch), 8);
  const fine = fbm(seedOf(tale, "floor", ch, "fine"), FLOOR, 3, 4);
  const painter = (FLOOR_STYLE[ch] ?? FLOOR_STYLE["."])(pal, (x, y) => n((x / FLOOR) * 8, (y / FLOOR) * 8) * 0.5 + fine(x, y) * 0.5);
  const t = fill(texture(FLOOR, FLOOR), painter);
  if (decal && DECALS[decal]) DECALS[decal](pal, t, random(seedOf(tale, "decal", decal)), (x, y) => fine(x, y));
  return t;
}

export function paintCeiling(tale) {
  const pal = paletteOf(tale);
  const n = fbm(seedOf(tale, "ceiling"), FLOOR, 3, 4);
  return fill(texture(FLOOR, FLOOR), (x, y) => {
    const beam = y % 32 < 7;
    return shade(beam ? C(pal, "timber") : C(pal, "wood"), (beam ? 0.7 : 0.5) + n(x, y) * 0.2);
  });
}

// ── Skies ─────────────────────────────────────────────────────────────────
export const SKY_W = 512,
  SKY_H = 96;

/** The far skyline for each tradition, as a silhouette over the sky gradient. */
export function paintSkyline(tale) {
  const pal = paletteOf(tale);
  const t = texture(SKY_W, SKY_H);
  const r = random(seedOf(tale, "skyline"));
  const far = shade(C(pal, "leaf"), 0.42),
    near = shade(C(pal, "leaf"), 0.3);
  const hills = (amp, base, color, freq) => {
    const n = noise2(seedOf(tale, "hills", base), 16);
    for (let x = 0; x < SKY_W; x++) {
      const top = SKY_H - base - n((x / SKY_W) * 16 * freq, 1) * amp;
      for (let y = Math.floor(top); y < SKY_H; y++) plot(t, x, y, color);
    }
  };
  if (tale === "wisdom") {
    hills(26, 8, far, 1);
    // Flat-topped forest giants above the canopy line.
    for (let i = 0; i < 9; i++) {
      const x = r() * SKY_W,
        h = 30 + r() * 30;
      rect(t, x - 1.5, SKY_H - h, 3, h, near);
      ellipse(t, x, SKY_H - h, 18 + r() * 12, 6 + r() * 3, near);
    }
    hills(10, 0, near, 2);
  } else if (tale === "tide") {
    // Pine headlands, then the flat sea line.
    hills(40, 18, shade(C(pal, "stone"), 0.55), 0.7);
    for (let i = 0; i < 14; i++) {
      const x = r() * SKY_W,
        h = 14 + r() * 18,
        base = SKY_H - 22 - r() * 20;
      polygon(t, [[x, base - h], [x - 7, base], [x + 7, base]], near);
    }
    rect(t, 0, SKY_H - 12, SKY_W, 12, shade(C(pal, "water"), 0.7));
  } else if (tale === "orchestra") {
    hills(30, 10, shade(C(pal, "grassDark"), 0.6), 0.8);
    // A church spire and village roofs on the far hill.
    const x0 = SKY_W * 0.3;
    polygon(t, [[x0, SKY_H - 70], [x0 - 5, SKY_H - 40], [x0 + 5, SKY_H - 40]], near);
    rect(t, x0 - 5, SKY_H - 40, 10, 30, near);
    for (let i = 0; i < 6; i++) {
      const x = x0 + 14 + i * 16;
      polygon(t, [[x, SKY_H - 44], [x - 9, SKY_H - 34], [x + 9, SKY_H - 34]], near);
      rect(t, x - 7, SKY_H - 34, 14, 20, near);
    }
    hills(12, 0, shade(C(pal, "leaf"), 0.35), 2);
  } else {
    // Domes, minarets and palms over the flat roofs of the city.
    const roofs = shade(C(pal, "wallDark"), 0.6);
    for (let x = 0; x < SKY_W; x += 22 + Math.floor(r() * 16)) rect(t, x, SKY_H - 20 - r() * 16, 24, 40, roofs);
    for (let i = 0; i < 4; i++) {
      const x = 60 + i * 120 + r() * 30;
      ellipse(t, x, SKY_H - 34, 16, 16, roofs);
      rect(t, x + 30, SKY_H - 70, 5, 60, roofs);
      ellipse(t, x + 32.5, SKY_H - 72, 5, 5, roofs);
    }
    for (let i = 0; i < 8; i++) {
      const x = r() * SKY_W;
      line(t, x, SKY_H, x + 4, SKY_H - 40, 2, near);
      for (let k = 0; k < 6; k++) line(t, x + 4, SKY_H - 40, x + 4 + Math.cos(k * 1.05) * 14, SKY_H - 40 + Math.sin(k * 1.05) * 6 + 4, 2, near);
    }
  }
  return t;
}

/** Every texture a tale needs, painted once when the tale opens. */
export function paintTale(tale, { walls = [], floors = [] } = {}) {
  const wallTex = new Map(walls.map((k) => [k, paintWall(tale, k)]));
  const floorTex = new Map(floors.map(([ch, decal]) => [`${ch}|${decal ?? ""}`, paintFloor(tale, ch, decal)]));
  return { walls: wallTex, floors: floorTex, ceiling: paintCeiling(tale), skyline: paintSkyline(tale) };
}
