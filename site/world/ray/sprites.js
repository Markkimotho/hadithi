// People, animals and things, painted in code as billboards for the
// first-person world. Each sprite is a texture plus its size in the world:
//
//   { tex, frames: [tex, ...], w, h, emit, side }
//
// w and h are metres; the renderer stands the sprite on the floor at its
// place. frames (people and animals) are idle, step, idle, step mirrored, so
// anyone walking moves their legs. emit (0..1) is how much the thing glows on
// its own (fires, lanterns). side marks animals painted side-on, which the
// renderer mirrors to face the way they walk.
//
// Every kind in every map has a painter here; test/ray-art.test.js and
// scripts/art-check.mjs fail if one is missing or paints nothing.
import { texture, rect, ellipse, polygon, line, plot, rgb, mix, shade, outline, mirror, random } from "./paint.js";
import { paletteOf } from "./textures.js";
import { hash32 } from "../../engine/rng.js";

const P = (pal, key) => rgb(pal[key]);

// ── People ────────────────────────────────────────────────────────────────
/**
 * How each person looks. robe/trim name palette keys or colours; head is
 * bare, short, wrap, turban, cap, hood, kasa (a straw hat), long or bun.
 * pattern: kente, stripe, kimono or plain. carry: what is in their hands.
 */
export const PEOPLE = {
  kweku: { robe: "cloth3", trim: "cloth2", head: "short", pattern: "plain", scale: 0.86 },
  anansi: { robe: "cloth", trim: "cloth2", head: "short", pattern: "kente", spider: true, thin: true },
  elder: { robe: "cloth2", trim: "cloth", head: "short", hair: "#d8d0c4", beard: "#e4ddd2", pattern: "kente", carry: "staff", stoop: true },
  potter: { robe: "cloth3", trim: "accent", head: "wrap", wrap: "cloth", pattern: "stripe", carry: "clay", woman: true },
  ferryman: { robe: "cloth3", trim: "earth", head: "short", pattern: "plain", carry: "pole", bare: true },
  woodboy: { robe: "cloth2", trim: "cloth", head: "short", pattern: "plain", carry: "bundle", scale: 0.72 },
  villager: { robe: "cloth", trim: "cloth2", head: "wrap", wrap: "cloth2", pattern: "kente", woman: true },
  child: { robe: "cloth2", trim: "cloth3", head: "short", pattern: "plain", scale: 0.64 },
  urashima: { robe: "cloth2", trim: "cloth3", head: "short", pattern: "plain", carry: "rod" },
  archivist: { robe: "cloth2", trim: "cloth3", head: "bun", hair: "#c8c4c0", pattern: "kimono", carry: "scroll", stoop: true },
  otohime: { robe: "cloth", trim: "cloth3", head: "long", pattern: "kimono", woman: true, layers: true },
  attendant: { robe: "cloth3", trim: "cloth", head: "bun", pattern: "kimono", woman: true },
  worker: { robe: "cloth2", trim: "plaster", head: "kasa", pattern: "plain", carry: "bundle" },
  miller: { robe: "cloth3", trim: "plaster", head: "cap", cap: "plaster", pattern: "plain", stout: true, apron: "#e8e2d4" },
  thief: { robe: "#3a3430", trim: "#5a4a3a", head: "hood", pattern: "plain", mask: true, carry: "sack" },
  cadi: { robe: "cloth3", trim: "cloth2", head: "cap", cap: "cloth", pattern: "stripe", scale: 0.7 },
  merchant: { robe: "cloth2", trim: "cloth3", head: "turban", turban: "plaster", beard: "#2a1e16", pattern: "stripe", stout: true },
  townsman: { robe: "cloth3", trim: "cloth", head: "turban", turban: "cloth", pattern: "plain" },
  townswoman: { robe: "cloth2", trim: "accent", head: "wrap", wrap: "cloth", pattern: "plain", woman: true },
  stranger: { robe: "#6a5a48", trim: "#4a3e32", head: "hood", pattern: "plain", carry: "staff" },
  alicogia: { robe: "cloth3", trim: "cloth2", head: "turban", turban: "#f0ece4", beard: "#e0dad0", pattern: "stripe", stoop: true },
  dealer: { robe: "cloth", trim: "cloth3", head: "turban", turban: "cloth3", beard: "#2a1e16", pattern: "stripe" },
  judge: { robe: "#2a2a34", trim: "cloth2", head: "turban", turban: "#f4f0e8", beard: "#3a2e24", pattern: "plain", stout: true, tall: true },
  clerk: { robe: "cloth2", trim: "plaster", head: "cap", cap: "cloth3", pattern: "plain", carry: "scroll" },
  wife: { robe: "cloth", trim: "cloth3", head: "wrap", wrap: "cloth2", pattern: "stripe", woman: true },
};

function humanFrame(pal, look, step, seed) {
  const t = texture(64, 128);
  const r = random(seed);
  const s = look.scale ?? 1;
  const color = (key, fallback) => rgb(pal[key] ?? key ?? fallback);
  const skin = P(pal, r() > 0.5 ? "skin" : "skinLight");
  const robe = color(look.robe),
    trim = color(look.trim);
  // Figure metrics in pixels, scaled about the feet.
  const foot = 126,
    cx = 32;
  const H = 118 * s;
  const headR = 7.5 * (s < 0.8 ? 1.15 : 1);
  const headY = foot - H + headR + (look.stoop ? 3 : 0);
  const shoulder = headY + headR + 4;
  const hip = foot - H * 0.42;
  const halfW = (look.stout ? 13 : look.thin ? 8 : 10.5) * Math.max(0.75, s);
  const lean = look.stoop ? 2 : 0;
  // Legs, with a stride on step frames.
  const stride = step * 5 * s;
  const legC = shade(skin, 0.86);
  line(t, cx - 4, hip, cx - 4 - stride, foot - 2, 5 * s + 1, legC);
  line(t, cx + 4, hip, cx + 4 + stride, foot - 2, 5 * s + 1, legC);
  ellipse(t, cx - 4 - stride - 1, foot - 1.5, 4 * s + 1, 2, shade(P(pal, "ink"), 1.4));
  ellipse(t, cx + 4 + stride + 1, foot - 1.5, 4 * s + 1, 2, shade(P(pal, "ink"), 1.4));
  // Robe: wider at the hem for women and long robes; a tunic otherwise.
  const hem = look.woman || look.pattern === "kimono" || look.tall ? foot - 8 : hip + 10;
  const hemHalf = halfW + (look.woman || look.pattern === "kimono" ? 4 : 1);
  const body = [
    [cx - halfW + lean, shoulder],
    [cx + halfW + lean, shoulder],
    [cx + hemHalf, hem],
    [cx - hemHalf, hem],
  ];
  polygon(t, body, robe);
  // Cloth pattern.
  for (let y = Math.ceil(shoulder); y < hem; y++)
    for (let x = cx - hemHalf; x <= cx + hemHalf; x++) {
      const i = (y * 64 + (x | 0)) | 0;
      if (t.data[i] >>> 24 < 128) continue;
      const u = x - cx,
        v = y - shoulder;
      let c = null;
      if (look.pattern === "kente" && ((Math.floor(v / 5) + Math.floor((u + 32) / 5)) % 2 === 0)) c = (Math.floor(v / 10) % 2 ? trim : P(pal, "accent"));
      if (look.pattern === "stripe" && Math.floor((u + 32) / 3) % 3 === 0) c = trim;
      if (look.pattern === "kimono" && Math.abs(u - (v * 0.35 - 3)) < 2 && v < 26) c = trim;
      if (c) plot(t, x, y, c);
      // Soft light from the upper left.
      if (u < -halfW * 0.4) plot(t, x, y, [255, 255, 255], 0.06);
      if (u > halfW * 0.5) plot(t, x, y, [0, 0, 0], 0.12);
    }
  if (look.layers) polygon(t, [[cx - hemHalf - 2, hem - 16], [cx + hemHalf + 2, hem - 16], [cx + hemHalf + 3, hem + 2], [cx - hemHalf - 3, hem + 2]], trim);
  if (look.apron) rect(t, cx - halfW + 3, hip - 14, halfW * 2 - 6, 26, rgb(look.apron));
  if (look.bare) polygon(t, [[cx - halfW, shoulder], [cx - 2, shoulder], [cx - 2, shoulder + 14], [cx - halfW, shoulder + 12]], skin);
  // Sash.
  rect(t, cx - halfW + 1, hip - 4, halfW * 2 - 2, 3, trim);
  // Arms swing against the legs.
  const swing = -step * 4 * s;
  const armL = [cx - halfW - 1 + lean, shoulder + 2],
    armR = [cx + halfW + 1 + lean, shoulder + 2];
  const handL = [armL[0] - 3 + swing, hip + 4],
    handR = [armR[0] + 3 - swing, hip + 4];
  if (look.carry === "bundle") {
    handL[1] = headY - 6;
    handR[1] = headY - 6;
    handL[0] = cx - 10;
    handR[0] = cx + 10;
  }
  line(t, ...armL, ...handL, 4.5 * s + 0.5, robe);
  line(t, ...armR, ...handR, 4.5 * s + 0.5, robe);
  ellipse(t, ...handL, 2.4, 2.4, skin);
  ellipse(t, ...handR, 2.4, 2.4, skin);
  if (look.spider) {
    // Anansi's other arms: thin, many-jointed, never quite still.
    for (const side of [-1, 1])
      for (let k = 0; k < 2; k++) {
        const ex = cx + side * (halfW + 10 + k * 4),
          ey = shoulder + 10 + k * 10 + step * side * 2;
        line(t, cx + side * halfW, shoulder + 6 + k * 8, ex, ey - 8, 2, P(pal, "ink"));
        line(t, ex, ey - 8, ex + side * 3, ey + 6, 2, P(pal, "ink"));
      }
  }
  // Head and face.
  line(t, cx + lean, shoulder - 4, cx + lean, shoulder + 1, 5, skin);
  ellipse(t, cx + lean, headY, headR, headR + 0.6, skin, { light: 0.35 });
  const eyeY = headY + 0.5;
  plot(t, cx + lean - 3, eyeY, P(pal, "ink"));
  plot(t, cx + lean + 3, eyeY, P(pal, "ink"));
  plot(t, cx + lean - 3, eyeY - 1, P(pal, "ink"), 0.6);
  plot(t, cx + lean + 3, eyeY - 1, P(pal, "ink"), 0.6);
  line(t, cx + lean - 2, headY + 4.5, cx + lean + 2, headY + 4.5, 1, shade(skin, 0.6));
  if (look.mask) rect(t, cx + lean - 7, eyeY - 2, 14, 4, [20, 18, 18]);
  if (look.beard) polygon(t, [[cx + lean - 6, headY + 3], [cx + lean + 6, headY + 3], [cx + lean + 3, headY + 13], [cx + lean - 3, headY + 13]], rgb(look.beard));
  const hair = rgb(look.hair ?? pal.hair);
  const hx = cx + lean;
  switch (look.head) {
    case "short":
      ellipse(t, hx, headY - headR * 0.55, headR, headR * 0.55, hair);
      break;
    case "wrap":
      ellipse(t, hx, headY - headR * 0.7, headR + 2.5, headR * 0.75, color(look.wrap));
      ellipse(t, hx + 3, headY - headR - 3, 5, 4, shade(color(look.wrap), 0.85));
      break;
    case "turban":
      ellipse(t, hx, headY - headR * 0.75, headR + 3.5, headR * 0.95, color(look.turban));
      for (let k = -2; k <= 2; k++) line(t, hx - headR - 2, headY - headR * 0.6 + k * 2, hx + headR + 2, headY - headR * 0.9 + k * 2, 0.8, shade(color(look.turban), 0.82));
      break;
    case "cap":
      ellipse(t, hx, headY - headR * 0.6, headR + 0.5, headR * 0.6, color(look.cap));
      break;
    case "hood":
      ellipse(t, hx, headY - 1, headR + 3.5, headR + 3, robe);
      ellipse(t, hx, headY + 1, headR - 0.5, headR - 1, shade(skin, 0.55));
      break;
    case "kasa":
      polygon(t, [[hx - 15, headY - 2], [hx + 15, headY - 2], [hx, headY - 14]], rgb("#c8a868"));
      break;
    case "long":
      ellipse(t, hx, headY - headR * 0.5, headR + 1, headR * 0.65, hair);
      rect(t, hx - headR - 1, headY - 2, 4, 34, hair);
      rect(t, hx + headR - 3, headY - 2, 4, 34, hair);
      break;
    case "bun":
      ellipse(t, hx, headY - headR * 0.55, headR, headR * 0.55, hair);
      ellipse(t, hx, headY - headR - 3, 4.5, 4, hair);
      line(t, hx - 6, headY - headR - 4, hx + 6, headY - headR - 2, 1, P(pal, "accent"));
      break;
  }
  // What they hold.
  const [hxR, hyR] = handR;
  if (look.carry === "staff") line(t, hxR + 2, headY - 6, hxR + 3, foot, 2.4, P(pal, "wood"));
  if (look.carry === "pole") line(t, hxR + 2, headY - 26, hxR + 4, foot, 2.2, mix(P(pal, "wood"), [230, 210, 160], 0.4));
  if (look.carry === "rod") line(t, hxR, hyR, hxR + 14, headY - 20, 1.5, P(pal, "wood"));
  if (look.carry === "clay") ellipse(t, hxR + 2, hyR - 2, 5, 5.5, mix(P(pal, "earth"), [200, 120, 80], 0.4), { light: 0.4 });
  if (look.carry === "scroll") rect(t, hxR - 2, hyR - 6, 4, 11, rgb("#efe4c8"));
  if (look.carry === "sack") ellipse(t, hxR + 4, hyR + 4, 7, 9, rgb("#8a7a5a"), { light: 0.3 });
  if (look.carry === "bundle") rect(t, cx - 13, headY - headR - 9, 26, 7, P(pal, "wood"));
  return outline(t, P(pal, "ink"), 0.75);
}

/** Size in metres of a person of this look. */
const personHeight = (look) => 1.72 * (look.scale ?? 1) * (look.tall ? 1.05 : 1);

// ── Animals ───────────────────────────────────────────────────────────────
function bird(pal, kind, step) {
  const t = texture(64, 64);
  const look = {
    hen: { body: "#e1c89c", wing: "#c8a878", comb: "#b83a2a", size: 1 },
    rooster: { body: "#a8482a", wing: "#3a5a3a", comb: "#d23a2a", size: 1.15, tail: "#1e3a2e" },
    bird: { body: "#3f4c5a", wing: "#2e3844", comb: null, size: 0.7 },
    gull: { body: "#f0f0ea", wing: "#9aa0a6", comb: null, size: 0.9 },
  }[kind];
  const s = look.size;
  const cy = 64 - 18 * s;
  line(t, 30, cy + 8 * s, 30 - step * 2, 62, 1.6, rgb("#d8a040"));
  line(t, 36, cy + 8 * s, 36 + step * 2, 62, 1.6, rgb("#d8a040"));
  if (look.tail) polygon(t, [[16, cy - 14 * s], [24, cy], [12, cy + 2]], rgb(look.tail));
  ellipse(t, 32, cy, 15 * s, 11 * s, rgb(look.body), { light: 0.4 });
  ellipse(t, 29, cy + 1, 9 * s, 6 * s, rgb(look.wing));
  ellipse(t, 44 * (1 - (1 - s) * 0.2), cy - 10 * s, 6 * s, 6 * s, rgb(look.body), { light: 0.3 });
  polygon(t, [[49, cy - 11 * s], [55, cy - 9 * s], [49, cy - 7 * s]], rgb("#e0a33a"));
  plot(t, 46, cy - 11 * s, [20, 16, 12]);
  if (look.comb) {
    ellipse(t, 43, cy - 17 * s, 4 * s, 2.5 * s, rgb(look.comb));
    ellipse(t, 47, cy - 5 * s, 1.6, 2.4, rgb(look.comb));
  }
  return outline(t, P(pal, "ink"), 0.7);
}

function beast(pal, kind, step) {
  const t = texture(64, 64);
  const look = {
    dog: { body: "#8a6a4a", belly: "#c8a880", h: 26, len: 20, ears: "flop", tail: "up" },
    cat: { body: "#4a4440", belly: "#8a8078", h: 18, len: 15, ears: "point", tail: "curl" },
    streetcat: { body: "#c49a5a", belly: "#e8c890", h: 18, len: 15, ears: "point", tail: "curl" },
    goat: { body: "#e8e0d0", belly: "#c8bca8", h: 32, len: 20, ears: "horn", tail: "up" },
    donkey: { body: "#8a8478", belly: "#d4cec2", h: 40, len: 24, ears: "long", tail: "down" },
  }[kind];
  const ground = 62;
  const back = ground - look.h;
  const cx = 30;
  // Legs, front and back pairs out of phase.
  for (const [x, phase] of [[cx - look.len + 4, 1], [cx - look.len + 8, -1], [cx + look.len - 6, -1], [cx + look.len - 2, 1]])
    line(t, x, back + 8, x + step * phase * 3, ground, 3, shade(rgb(look.body), phase > 0 ? 0.8 : 1));
  ellipse(t, cx, back + 6, look.len, look.h * 0.3, rgb(look.body), { light: 0.35 });
  ellipse(t, cx, back + 9, look.len * 0.8, look.h * 0.14, rgb(look.belly));
  const headX = cx + look.len + 5,
    headY = back - (kind === "donkey" ? 6 : 2);
  line(t, cx + look.len - 4, back + 4, headX - 2, headY + 3, kind === "donkey" ? 9 : 6, rgb(look.body));
  ellipse(t, headX, headY, kind === "donkey" ? 8 : 6, kind === "donkey" ? 6 : 5, rgb(look.body), { light: 0.3 });
  ellipse(t, headX + 5, headY + 2, kind === "donkey" ? 5 : 3, 3, rgb(look.belly));
  plot(t, headX + 1, headY - 1, [16, 12, 10]);
  if (look.ears === "point") {
    polygon(t, [[headX - 4, headY - 3], [headX - 2, headY - 10], [headX, headY - 4]], rgb(look.body));
    polygon(t, [[headX + 1, headY - 4], [headX + 3, headY - 10], [headX + 5, headY - 3]], rgb(look.body));
  } else if (look.ears === "flop") ellipse(t, headX - 3, headY + 1, 2.5, 5, shade(rgb(look.body), 0.7));
  else if (look.ears === "long") {
    line(t, headX - 3, headY - 4, headX - 7, headY - 18, 3, rgb(look.body));
    line(t, headX, headY - 4, headX + 1, headY - 18, 3, rgb(look.body));
  } else if (look.ears === "horn") {
    line(t, headX - 2, headY - 4, headX - 7, headY - 12, 2, rgb("#8a7a62"));
    line(t, headX + 1, headY - 4, headX - 2, headY - 13, 2, rgb("#8a7a62"));
  }
  const tx = cx - look.len;
  if (look.tail === "up") line(t, tx + 1, back + 2, tx - 5, back - 8, 2.4, rgb(look.body));
  if (look.tail === "curl") {
    line(t, tx + 1, back + 4, tx - 6, back - 4, 2, rgb(look.body));
    line(t, tx - 6, back - 4, tx - 2, back - 10, 2, rgb(look.body));
  }
  if (look.tail === "down") line(t, tx + 1, back + 4, tx - 3, back + 18, 2, rgb(look.body));
  if (kind === "donkey") rect(t, cx - 8, back - 2, 14, 10, rgb(pal.cloth));
  return outline(t, P(pal, "ink"), 0.7);
}

function sea(pal, kind, step) {
  const t = texture(64, 64);
  if (kind === "turtle") {
    for (const [x, y, sx] of [[14, 50, -1], [50, 50, 1], [18, 38, -1], [46, 38, 1]]) ellipse(t, x + step * sx, y, 6, 3.5, rgb("#7a9a6a"));
    ellipse(t, 32, 26, 6, 6, rgb("#6a8a5a"), { light: 0.3 });
    ellipse(t, 32, 44, 18, 13, rgb("#4a6a42"), { light: 0.45 });
    for (let a = 0; a < 6; a++) ellipse(t, 32 + Math.cos(a) * 9, 44 + Math.sin(a) * 6, 4, 3, rgb("#5e7e4e"));
    plot(t, 30, 25, [16, 12, 10]);
    plot(t, 34, 25, [16, 12, 10]);
  } else if (kind === "fish") {
    ellipse(t, 30, 30, 13, 6, rgb("#d8e4ea"), { light: 0.5 });
    polygon(t, [[41, 30], [50, 23 + step], [50, 37 - step]], rgb("#b8c8d0"));
    plot(t, 22, 29, [16, 12, 10]);
  } else {
    ellipse(t, 32, 50, 11, 7, rgb("#c8583a"), { light: 0.4 });
    for (const sx of [-1, 1]) {
      line(t, 32 + sx * 8, 52, 32 + sx * 16, 60, 2, rgb("#c8583a"));
      line(t, 32 + sx * 8, 48, 32 + sx * 15, 40 + step, 2.4, rgb("#c8583a"));
      ellipse(t, 32 + sx * 16, 38 + step, 3.5, 3, rgb("#d8683a"));
    }
  }
  return outline(t, P(pal, "ink"), 0.6);
}

const ANIMALS = {
  hen: { paint: bird, h: 0.45, w: 0.45 },
  rooster: { paint: bird, h: 0.55, w: 0.5 },
  bird: { paint: bird, h: 0.3, w: 0.3 },
  gull: { paint: bird, h: 0.4, w: 0.4 },
  dog: { paint: beast, h: 0.75, w: 0.75 },
  cat: { paint: beast, h: 0.45, w: 0.45 },
  streetcat: { paint: beast, h: 0.45, w: 0.45 },
  goat: { paint: beast, h: 0.85, w: 0.85 },
  donkey: { paint: beast, h: 1.45, w: 1.45 },
  turtle: { paint: sea, h: 0.7, w: 0.8, front: true },
  fish: { paint: sea, h: 0.5, w: 0.5, lift: 0.7 },
  crab: { paint: sea, h: 0.3, w: 0.35, front: true },
};

// ── Things ────────────────────────────────────────────────────────────────
// Archetypes paint whole families of props; PROPS maps each map kind to one.
const vessel = (shape) => (pal, t, r, k) => {
  const body = rgb(k.color ? pal[k.color] ?? k.color : mix(P(pal, "earth"), [196, 110, 70], 0.45));
  const cx = 32;
  if (shape === "jar") {
    ellipse(t, cx, 40, 15, 20, body, { light: 0.5 });
    rect(t, cx - 6, 14, 12, 8, shade(body, 0.85));
    ellipse(t, cx, 14, 7, 2.5, shade(body, 0.6));
  } else if (shape === "pot") {
    ellipse(t, cx, 42, 22, 18, body, { light: 0.5 });
    ellipse(t, cx, 26, 16, 4, shade(body, 0.55));
    for (let x = cx - 18; x < cx + 18; x += 4) plot(t, x, 36, shade(body, 1.3));
  } else if (shape === "basket") {
    polygon(t, [[12, 32], [52, 32], [46, 62], [18, 62]], body);
    for (let y = 34; y < 62; y += 4) line(t, 14, y, 50, y, 1, shade(body, 0.7));
    for (let x = 16; x < 50; x += 5) line(t, x, 32, x + 1, 62, 1, shade(body, 1.2));
    ellipse(t, cx, 32, 20, 4, shade(body, 0.6));
  } else if (shape === "barrel") {
    ellipse(t, cx, 38, 17, 24, body, { light: 0.45 });
    rect(t, 15, 20, 34, 3, [60, 54, 50]);
    rect(t, 15, 54, 34, 3, [60, 54, 50]);
  } else if (shape === "sack") {
    ellipse(t, cx, 46, 18, 16, body, { light: 0.4 });
    polygon(t, [[24, 32], [40, 32], [36, 22], [28, 22]], body);
    line(t, 26, 30, 38, 30, 2, shade(body, 0.6));
  } else if (shape === "gourd") {
    ellipse(t, cx, 48, 13, 13, body, { light: 0.5 });
    ellipse(t, cx, 30, 7, 8, body, { light: 0.5 });
  } else {
    // bowls
    ellipse(t, cx, 52, 22, 9, body, { light: 0.4 });
    ellipse(t, cx, 47, 19, 4, k.fill ? rgb(pal[k.fill] ?? k.fill) : shade(body, 0.6));
  }
};

const boxy = (pal, t, r, k) => {
  const wood = rgb(pal[k.color ?? "wood"] ?? k.color);
  const top = k.top ?? 30;
  rect(t, 6, top, 52, 64 - top, wood);
  rect(t, 6, top, 52, 4, shade(wood, 1.25));
  for (let x = 6; x < 58; x += 13) rect(t, x, top + 4, 1, 64 - top, shade(wood, 0.65));
  if (k.legs) {
    for (let y = top + 8; y < 64; y++) for (let x = 10; x < 54; x++) t.data[y * 64 + x] = 0;
    rect(t, 8, top + 6, 5, 64 - top - 6, shade(wood, 0.8));
    rect(t, 51, top + 6, 5, 64 - top - 6, shade(wood, 0.8));
  }
  if (k.goods) for (let i = 0; i < 5; i++) ellipse(t, 12 + i * 10, top - 3, 4, 4, rgb(pal[k.goods] ?? k.goods), { light: 0.4 });
};

const post = (pal, t, r, k) => {
  const wood = rgb(pal[k.color ?? "wood"] ?? k.color);
  rect(t, 28, k.top ?? 8, 8, 64 - (k.top ?? 8), wood);
  rect(t, 28, k.top ?? 8, 2, 64 - (k.top ?? 8), shade(wood, 1.3));
  if (k.column) {
    const c = rgb(pal[k.color] ?? k.color);
    rect(t, 20, 6, 24, 58, c);
    rect(t, 20, 6, 5, 58, shade(c, 1.25));
    rect(t, 39, 6, 5, 58, shade(c, 0.7));
    rect(t, 16, 2, 32, 6, P(pal, "timber"));
    rect(t, 16, 58, 32, 6, rgb(pal.stone));
  }
  if (k.sign) {
    rect(t, 12, 14, 40, 12, shade(wood, 1.15));
    line(t, 16, 20, 46, 20, 1, P(pal, "ink"));
  }
  if (k.bell) {
    ellipse(t, 32, 30, 8, 9, rgb("#c8a040"), { light: 0.6 });
    line(t, 32, 8, 32, 22, 1, P(pal, "ink"));
  }
};

const flame = (pal, t, r, k) => {
  if (k.base === "pit") {
    ellipse(t, 32, 56, 20, 6, rgb("#4a4440"));
    for (let i = 0; i < 6; i++) line(t, 18 + i * 5, 58, 30 + i * 2, 46, 2.5, P(pal, "wood"));
  }
  if (k.base === "post") {
    rect(t, 30, 30, 4, 34, P(pal, "timber"));
    rect(t, 24, 14, 16, 18, rgb("#3a3028"));
  }
  if (k.base === "lamp") {
    ellipse(t, 32, 54, 12, 5, rgb("#b8862e"), { light: 0.6 });
    polygon(t, [[20, 54], [44, 54], [40, 48], [24, 48]], rgb("#c8963e"));
  }
  const cy = k.base === "post" ? 24 : k.base === "lamp" ? 42 : 40;
  const size = k.base === "pit" ? 1 : 0.5;
  ellipse(t, 32, cy, 10 * size + 2, 14 * size + 2, [232, 120, 40]);
  ellipse(t, 32, cy + 2 * size, 6 * size + 1.5, 9 * size + 1.5, [252, 200, 80]);
  ellipse(t, 32, cy + 4 * size, 3 * size + 1, 4 * size + 1, [255, 244, 200]);
};

const plant = (pal, t, r, k) => {
  const leaf = P(pal, "leaf"),
    light = P(pal, "leafLight");
  if (k.shape === "reeds") for (let i = 0; i < 12; i++) line(t, 14 + r() * 36, 64, 10 + r() * 44, 10 + r() * 20, 1.6, mix(leaf, light, r()));
  else if (k.shape === "palm") {
    line(t, 32, 64, 36, 10, 5, P(pal, "bark"));
    for (let a = 0; a < 7; a++) line(t, 36, 10, 36 + Math.cos(a * 0.9) * 26, 10 + Math.sin(a * 0.9) * 10 + 6, 3, a % 2 ? leaf : light);
  } else if (k.shape === "tree") {
    rect(t, 28, 30, 8, 34, P(pal, "bark"));
    ellipse(t, 32, 22, 26, 20, leaf, { light: 0.5 });
    for (let i = 0; i < 10; i++) ellipse(t, 12 + r() * 40, 8 + r() * 28, 4, 4, k.fruit ? rgb(k.fruit) : light);
  } else if (k.shape === "mushrooms") {
    for (let i = 0; i < 4; i++) {
      const x = 14 + i * 11;
      rect(t, x - 1, 52, 3, 12, rgb("#e8dcc4"));
      ellipse(t, x, 52, 6, 4, rgb("#b84a2a"), { light: 0.5 });
    }
  } else if (k.shape === "blossom") {
    line(t, 32, 64, 30, 20, 4, P(pal, "bark"));
    for (let i = 0; i < 26; i++) ellipse(t, 10 + r() * 44, 6 + r() * 26, 3, 3, rgb(r() > 0.3 ? "#f2c4d0" : "#fff0f4"));
  } else {
    // vines, weed, roots: a tangle
    for (let i = 0; i < 9; i++) {
      let x = 10 + r() * 44,
        y = 64;
      for (let s = 0; s < 6; s++) {
        const nx = x + (r() - 0.5) * 12,
          ny = y - 6 - r() * (k.tall ? 10 : 4);
        line(t, x, y, nx, ny, k.shape === "roots" ? 3 : 2, k.shape === "roots" ? P(pal, "bark") : mix(leaf, light, r()));
        x = nx;
        y = ny;
      }
    }
  }
};

const rock = (pal, t, r, k) => {
  const stone = rgb(pal[k.color ?? "stone"] ?? k.color);
  const w = k.rw ?? 22,
    h = k.rh ?? 16;
  ellipse(t, 32, 64 - h, w, h, stone, { light: 0.55 });
  for (let i = 0; i < 5; i++) ellipse(t, 32 + (r() - 0.5) * w, 64 - h + (r() - 0.5) * h, 3, 2, shade(stone, 0.75));
  if (k.carved) for (let i = 0; i < 3; i++) line(t, 22, 64 - h - 4 + i * 5, 42, 64 - h - 4 + i * 5, 1, shade(stone, 0.5));
  if (k.shell) {
    for (let a = -1.2; a <= 1.2; a += 0.3) line(t, 32, 62, 32 + Math.sin(a) * 18, 62 - Math.cos(a) * 16, 1.2, shade(stone, 0.7));
  }
};

const cloth = (pal, t, r, k) => {
  const c = rgb(pal[k.color ?? "cloth"] ?? k.color);
  if (k.shape === "hang") {
    rect(t, 6, 6, 52, 3, P(pal, "timber"));
    for (let x = 8; x < 56; x++) for (let y = 9; y < 60 - Math.sin(x * 0.4) * 3; y++) plot(t, x, y, shade(c, 0.85 + Math.sin(x * 0.6) * 0.15));
  } else if (k.shape === "cushion") ellipse(t, 32, 54, 22, 9, c, { light: 0.5 });
  else if (k.shape === "nets") {
    for (let x = 8; x < 58; x += 6) line(t, x, 20, x + 4, 62, 1, rgb("#c8b890"));
    for (let y = 20; y < 62; y += 6) line(t, 8, y, 58, y + 2, 1, rgb("#c8b890"));
    for (let i = 0; i < 4; i++) ellipse(t, 14 + i * 12, 22, 3, 3, rgb("#e0c060"));
  } else if (k.shape === "coil") {
    for (let i = 0; i < 4; i++) ellipse(t, 32, 56 - i * 3, 16 - i * 2, 5, i % 2 ? rgb("#b89a64") : rgb("#9a7e50"));
  } else if (k.shape === "screen") {
    for (let p = 0; p < 4; p++) {
      rect(t, 4 + p * 14, 10, 13, 54, rgb("#efe6d2"));
      rect(t, 4 + p * 14, 10, 13, 2, P(pal, "timber"));
      rect(t, 4 + p * 14, 10, 1, 54, P(pal, "timber"));
      line(t, 6 + p * 14, 50, 14 + p * 14, 26, 1.5, P(pal, "leaf"));
    }
  } else {
    // folded cloth, scroll, bundle, bread: a soft lump
    ellipse(t, 32, 54, 16, 8, c, { light: 0.5 });
    line(t, 20, 52, 44, 52, 1, shade(c, 0.7));
  }
};

const timber = (pal, t, r, k) => {
  const wood = P(pal, "wood");
  if (k.shape === "log") {
    ellipse(t, 32, 54, 30, 8, P(pal, "bark"), { light: 0.4 });
    ellipse(t, 60, 54, 4, 8, shade(wood, 1.3));
  } else if (k.shape === "stump") {
    rect(t, 18, 40, 28, 24, P(pal, "bark"));
    ellipse(t, 32, 40, 14, 5, shade(wood, 1.3));
  } else if (k.shape === "pile") {
    for (let i = 0; i < 6; i++) ellipse(t, 16 + (i % 3) * 16, 58 - Math.floor(i / 3) * 10, 8, 5, i % 2 ? P(pal, "bark") : shade(wood, 1.2));
  } else if (k.shape === "boat") {
    polygon(t, [[2, 44], [62, 44], [54, 60], [10, 60]], wood);
    rect(t, 2, 44, 60, 3, shade(wood, 1.3));
    if (k.mast) line(t, 32, 44, 32, 6, 2, P(pal, "timber"));
  } else if (k.shape === "wheel") {
    for (let a = 0; a < 6.28; a += 0.04) plot(t, 32 + Math.cos(a) * 20, 40 + Math.sin(a) * 20, wood);
    for (let a = 0; a < 6.28; a += 0.785) line(t, 32, 40, 32 + Math.cos(a) * 20, 40 + Math.sin(a) * 20, 2, wood);
    ellipse(t, 32, 40, 4, 4, shade(wood, 0.7));
  } else if (k.shape === "cart") {
    rect(t, 6, 30, 52, 16, wood);
    for (const x of [16, 48]) {
      ellipse(t, x, 52, 10, 10, P(pal, "timber"));
      ellipse(t, x, 52, 6, 6, wood);
    }
  } else if (k.shape === "oar") line(t, 6, 60, 58, 20, 3, wood);
  else if (k.shape === "beam") rect(t, 0, 40, 64, 8, wood);
  else if (k.shape === "trunk") {
    rect(t, 0, 36, 64, 14, P(pal, "bark"));
    for (let x = 4; x < 64; x += 9) line(t, x, 36, x + 3, 50, 1, shade(P(pal, "bark"), 0.6));
  }
};

const frame = (pal, t, r, k) => {
  // Doors, windows, gates, fences: things set in a wall or across a way.
  const wood = rgb(pal[k.color ?? "timber"] ?? k.color);
  if (k.shape === "door") {
    rect(t, 14, 4, 36, 60, wood);
    for (let x = 18; x < 48; x += 8) rect(t, x, 6, 1, 58, shade(wood, 0.6));
    ellipse(t, 42, 36, 2, 2, rgb("#c8a040"));
  } else if (k.shape === "window") {
    rect(t, 14, 14, 36, 30, wood);
    rect(t, 18, 18, 28, 22, k.lit ? [255, 200, 110] : [40, 46, 56]);
    rect(t, 31, 18, 2, 22, wood);
    rect(t, 18, 28, 28, 2, wood);
  } else if (k.shape === "gate") {
    for (let x = 6; x < 60; x += 9) rect(t, x, 16, 5, 48, wood);
    rect(t, 4, 24, 56, 5, shade(wood, 1.2));
    rect(t, 4, 48, 56, 5, shade(wood, 1.2));
  } else if (k.shape === "fence") {
    for (let x = 4; x < 64; x += 20) rect(t, x, 22, 5, 42, wood);
    rect(t, 0, 30, 64, 4, shade(wood, 1.2));
    rect(t, 0, 46, 64, 4, shade(wood, 1.2));
  } else if (k.shape === "arch") {
    for (let a = Math.PI; a <= Math.PI * 2; a += 0.02)
      for (let w = 0; w < 6; w++) plot(t, 32 + Math.cos(a) * (26 - w), 40 + Math.sin(a) * (30 - w), rgb(pal.stone));
    rect(t, 6, 40, 6, 24, rgb(pal.stone));
    rect(t, 52, 40, 6, 24, rgb(pal.stone));
  }
};

const device = (pal, t, r, k) => {
  // The odd things a tale turns on: a well, scales, a dial, bells, a lectern.
  const wood = P(pal, "wood"),
    brass = rgb("#c8a040");
  switch (k.shape) {
    case "well":
      rect(t, 10, 36, 44, 28, rgb(pal.stone));
      for (let y = 36; y < 64; y += 7) line(t, 10, y, 54, y, 1, shade(rgb(pal.stone), 0.6));
      rect(t, 12, 8, 4, 28, wood);
      rect(t, 48, 8, 4, 28, wood);
      rect(t, 10, 8, 44, 4, wood);
      line(t, 32, 12, 32, 30, 1, rgb("#c8b890"));
      break;
    case "scales":
      rect(t, 30, 16, 4, 48, brass);
      line(t, 10, 18, 54, 18, 2, brass);
      for (const x of [12, 52]) {
        line(t, x, 18, x - 6, 32, 1, brass);
        line(t, x, 18, x + 6, 32, 1, brass);
        ellipse(t, x, 33, 9, 2.5, brass);
      }
      break;
    case "dial":
      ellipse(t, 32, 34, 26, 26, rgb(pal.stone), { light: 0.4 });
      for (let a = 0; a < 6.28; a += 0.52) line(t, 32 + Math.cos(a) * 18, 34 + Math.sin(a) * 18, 32 + Math.cos(a) * 24, 34 + Math.sin(a) * 24, 1.5, P(pal, "ink"));
      line(t, 32, 34, 44, 24, 2, P(pal, "accent"));
      break;
    case "bells":
      line(t, 32, 0, 32, 64, 1, rgb("#c8b890"));
      for (let y = 10; y < 64; y += 18) ellipse(t, 32, y, 6, 7, brass, { light: 0.6 });
      break;
    case "lectern":
      polygon(t, [[16, 18], [48, 12], [48, 22], [16, 28]], wood);
      rect(t, 29, 24, 6, 40, wood);
      rect(t, 20, 16, 22, 6, rgb("#efe4c8"));
      break;
    case "bottles":
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * 13;
        ellipse(t, x, 52, 5, 10, rgb(["#6ab0a0", "#a8c8d0", "#8aa860", "#c8a0d0"][i]), { alpha: 0.85, light: 0.6 });
        rect(t, x - 1.5, 36, 3, 8, rgb("#a8c8d0"));
      }
      break;
    case "knife":
      line(t, 20, 56, 44, 44, 3, rgb("#c8ccd0"));
      line(t, 14, 59, 21, 56, 4, wood);
      break;
    case "bubbles":
      for (let i = 0; i < 10; i++) {
        const x = 10 + r() * 44,
          y = 10 + r() * 50,
          s = 2 + r() * 4;
        for (let a = 0; a < 6.28; a += 0.2) plot(t, x + Math.cos(a) * s, y + Math.sin(a) * s, [220, 240, 250], 0.8);
      }
      break;
    case "tunnel":
      for (let a = Math.PI; a <= Math.PI * 2; a += 0.02)
        for (let w = 0; w < 10; w++) plot(t, 32 + Math.cos(a) * (30 - w), 64 + Math.sin(a) * (40 - w), shade(rgb(pal.stone), 0.6 + w * 0.03));
      break;
    case "light":
      // a far light, fireflies: points that glow
      for (let i = 0; i < (k.many ? 9 : 1); i++) ellipse(t, k.many ? 8 + r() * 48 : 32, k.many ? 10 + r() * 40 : 30, k.many ? 1.6 : 5, k.many ? 1.6 : 5, [255, 230, 140]);
      break;
    case "apples":
      for (let i = 0; i < 6; i++) ellipse(t, 18 + (i % 3) * 13, 56 - Math.floor(i / 3) * 9, 6, 6, rgb(i % 2 ? "#b83a2a" : "#c8a030"), { light: 0.5 });
      break;
    case "crocks":
      for (let i = 0; i < 3; i++) ellipse(t, 14 + i * 18, 50, 8, 12, mix(rgb(pal.earth), [200, 120, 80], 0.4), { light: 0.5 });
      break;
  }
};

/**
 * Every prop kind in every map: the archetype, its options, its size in
 * metres, and whether it glows. Unknown kinds fall back to a cairn so a new
 * map never breaks the world, and the art check names them.
 */
export const PROPS = {
  // vessels
  jar: { paint: vessel("jar"), h: 0.7, w: 0.5 },
  bigpot: { paint: vessel("pot"), h: 0.75, w: 0.9 },
  pot: { paint: vessel("pot"), h: 0.6, w: 0.7 },
  gourd: { paint: vessel("gourd"), h: 0.4, w: 0.3, color: "#c8a050" },
  basket: { paint: vessel("basket"), h: 0.5, w: 0.55, color: "#b8945a" },
  barrel: { paint: vessel("barrel"), h: 0.9, w: 0.6, color: "#8a5a34" },
  barrels: { paint: vessel("barrel"), h: 0.9, w: 0.6, color: "#8a5a34" },
  sacks: { paint: vessel("sack"), h: 0.6, w: 0.6, color: "#c8b48a" },
  bundle: { paint: vessel("sack"), h: 0.4, w: 0.5, color: "#9a7a4a" },
  clay: { paint: vessel("gourd"), h: 0.3, w: 0.35, color: "#a86f4c" },
  bowls: { paint: vessel("bowls"), h: 0.3, w: 0.6, fill: "#e8e0d0" },
  olivebowls: { paint: vessel("bowls"), h: 0.3, w: 0.6, fill: "#5a6a2a" },
  crocks: { paint: device, shape: "crocks", h: 0.5, w: 0.8 },
  bottles: { paint: device, shape: "bottles", h: 0.5, w: 0.8 },
  // furniture and goods
  crate: { paint: boxy, h: 0.6, w: 0.7, top: 24 },
  stool: { paint: boxy, h: 0.45, w: 0.5, top: 30, legs: true },
  rack: { paint: boxy, h: 0.9, w: 0.9, top: 12, legs: true, goods: "accent" },
  desk: { paint: boxy, h: 0.75, w: 0.95, top: 24, legs: true },
  lowtable: { paint: boxy, h: 0.4, w: 0.95, top: 34, legs: true, goods: "plaster" },
  feasttable: { paint: boxy, h: 0.8, w: 0.95, top: 22, legs: true, goods: "accent" },
  counter: { paint: boxy, h: 0.95, w: 1, top: 14, goods: "#5a6a2a" },
  shelf: { paint: boxy, h: 1.6, w: 1, top: 6, goods: "#a86f4c" },
  boxstand: { paint: boxy, h: 0.8, w: 0.6, top: 20, color: "timber" },
  dais: { paint: boxy, h: 0.5, w: 1, top: 34, color: "rug" },
  lowtray: { paint: boxy, h: 0.35, w: 0.95, top: 40, color: "#b8862e", goods: "#5a6a2a" },
  scales: { paint: device, shape: "scales", h: 1, w: 0.8 },
  lectern: { paint: device, shape: "lectern", h: 1.1, w: 0.7 },
  dial: { paint: device, shape: "dial", h: 1.4, w: 1.2 },
  bells: { paint: device, shape: "bells", h: 2.4, w: 0.4 },
  harnessbell: { paint: post, bell: true, h: 1.2, w: 0.5 },
  knife: { paint: device, shape: "knife", h: 0.3, w: 0.5 },
  bread: { paint: cloth, color: "#c8944e", h: 0.3, w: 0.5 },
  apples: { paint: device, shape: "apples", h: 0.35, w: 0.6 },
  scroll: { paint: cloth, color: "#efe4c8", h: 0.3, w: 0.5 },
  cloth: { paint: cloth, color: "cloth", h: 0.3, w: 0.6 },
  cushion: { paint: cloth, shape: "cushion", color: "cloth", h: 0.3, w: 0.7 },
  curtain: { paint: cloth, shape: "hang", color: "cloth2", h: 2, w: 1 },
  awning: { paint: cloth, shape: "hang", color: "cloth", h: 2.2, w: 1, lift: 0.9 },
  screen: { paint: cloth, shape: "screen", h: 1.6, w: 1 },
  nets: { paint: cloth, shape: "nets", h: 1.2, w: 1 },
  ropes: { paint: cloth, shape: "coil", h: 0.3, w: 0.6 },
  rope: { paint: cloth, shape: "coil", h: 0.3, w: 0.6 },
  cord: { paint: cloth, shape: "coil", h: 0.25, w: 0.5 },
  fishline: { paint: cloth, shape: "coil", h: 0.25, w: 0.5 },
  // fire and light
  fire: { paint: flame, base: "pit", h: 0.9, w: 0.8, emit: 1 },
  firepit: { paint: flame, base: "pit", h: 0.8, w: 0.9, emit: 1 },
  hearthfire: { paint: flame, base: "pit", h: 0.9, w: 1, emit: 1 },
  lantern: { paint: flame, base: "post", h: 1.6, w: 0.5, emit: 0.9 },
  lamp: { paint: flame, base: "lamp", h: 0.5, w: 0.4, emit: 0.9 },
  fireflies: { paint: device, shape: "light", many: true, h: 1.6, w: 1.2, emit: 1 },
  distantlight: { paint: device, shape: "light", h: 0.4, w: 0.4, emit: 1 },
  litwindow: { paint: frame, shape: "window", lit: true, h: 1.6, w: 1, emit: 0.7 },
  // posts, signs, gates
  post: { paint: post, h: 1.4, w: 0.3 },
  pillar: { paint: post, column: true, color: "wall", top: 64, h: 2.5, w: 0.6 },
  well: { paint: device, shape: "well", h: 1.4, w: 1 },
  gatepost: { paint: post, color: "stone", h: 1.4, w: 0.4 },
  signpost: { paint: post, sign: true, h: 1.6, w: 0.8 },
  milestone: { paint: rock, carved: true, rw: 10, rh: 18, h: 0.7, color: "stone" },
  door: { paint: frame, shape: "door", h: 2, w: 1 },
  window: { paint: frame, shape: "window", h: 1.6, w: 1 },
  kitchenwindow: { paint: frame, shape: "window", lit: true, h: 1.6, w: 1, emit: 0.4 },
  pantrywindow: { paint: frame, shape: "window", h: 1.6, w: 1 },
  frontgate: { paint: frame, shape: "gate", h: 1.4, w: 1 },
  fargate: { paint: frame, shape: "gate", h: 1.4, w: 1 },
  farmgate: { paint: frame, shape: "gate", h: 1.3, w: 1 },
  turninggate: { paint: frame, shape: "arch", h: 2.2, w: 1 },
  fieldfence: { paint: frame, shape: "fence", h: 1, w: 1 },
  fence: { paint: frame, shape: "fence", h: 1, w: 1 },
  niche: { paint: frame, shape: "arch", h: 1.6, w: 1 },
  tunnel: { paint: device, shape: "tunnel", h: 2.4, w: 1.4 },
  // wood
  log: { paint: timber, shape: "log", h: 0.45, w: 1 },
  stump: { paint: timber, shape: "stump", h: 0.6, w: 0.6 },
  woodpile: { paint: timber, shape: "pile", h: 0.6, w: 0.9 },
  canoe: { paint: timber, shape: "boat", h: 0.5, w: 1 },
  boat: { paint: timber, shape: "boat", mast: true, h: 1.8, w: 1 },
  boatoar: { paint: timber, shape: "oar", h: 0.5, w: 1 },
  wheel: { paint: timber, shape: "wheel", h: 1, w: 0.9 },
  cart: { paint: timber, shape: "cart", h: 1, w: 1 },
  beam: { paint: timber, shape: "beam", h: 0.6, w: 1, lift: 1.4 },
  slicktrunk: { paint: timber, shape: "trunk", h: 0.4, w: 1 },
  // growing things
  reeds: { paint: plant, shape: "reeds", h: 1.3, w: 0.8 },
  vines: { paint: plant, shape: "vines", tall: true, h: 1.6, w: 0.8 },
  weed: { paint: plant, shape: "vines", tall: true, h: 1.4, w: 0.8 },
  roots: { paint: plant, shape: "roots", h: 0.5, w: 1 },
  mushrooms: { paint: plant, shape: "mushrooms", h: 0.25, w: 0.5 },
  blossom: { paint: plant, shape: "blossom", h: 2.6, w: 1.4 },
  palmtree: { paint: plant, shape: "palm", h: 4, w: 2 },
  appletree: { paint: plant, shape: "tree", fruit: "#c83a2a", h: 3.4, w: 2.4 },
  // stone and shell
  stone: { paint: rock, rw: 22, rh: 8, h: 0.2, color: "stone" },
  boulder: { paint: rock, rw: 28, rh: 24, h: 1, color: "stone" },
  chartstone: { paint: rock, carved: true, rw: 18, rh: 20, h: 0.8, color: "stone" },
  shell: { paint: rock, shell: true, rw: 18, rh: 10, h: 0.3, color: "#e8d8c8" },
  potmarkstone: { paint: rock, rw: 10, rh: 8, h: 0.2 },
  bubbles: { paint: device, shape: "bubbles", h: 1.6, w: 1, lift: 0.2 },
};
const FALLBACK = { paint: rock, rw: 14, rh: 12, h: 0.5, w: 0.5, color: "stone" };

/** Rows and columns the painted figure covers. */
export function bounds(t) {
  let top = t.h,
    bottom = -1,
    left = t.w,
    right = -1;
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++)
      if (t.data[y * t.w + x] >>> 24 > 127) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
  return { top, bottom, left, right, height: Math.max(1, bottom - top + 1), width: Math.max(1, right - left + 1) };
}

/** World size of the whole texture, so the painted figure stands `height` metres tall. */
function sized(tex, height) {
  const texH = (height * tex.h) / bounds(tex).height;
  return { h: texH, w: (texH * tex.w) / tex.h };
}

/** Every person, animal and thing this tale's maps use, painted. */
export function spriteFor(tale, kind, variant = "") {
  const pal = paletteOf(tale);
  const seed = hash32(`${tale}:${kind}:${variant}`);
  if (PEOPLE[kind]) {
    const look = { ...PEOPLE[kind], ...tintOf(variant) };
    const idle = humanFrame(pal, look, 0, seed),
      a = humanFrame(pal, look, 1, seed),
      b = humanFrame(pal, look, -1, seed);
    return { tex: idle, frames: [idle, a, idle, b], ...sized(idle, personHeight(look)), emit: 0, lift: 0, person: true, known: true };
  }
  if (ANIMALS[kind]) {
    const spec = ANIMALS[kind];
    const idle = spec.paint(pal, kind, 0),
      a = spec.paint(pal, kind, 1),
      b = spec.paint(pal, kind, -1);
    return { tex: idle, frames: [idle, a, idle, b], ...sized(idle, spec.h), emit: 0, side: !spec.front, lift: spec.lift ?? 0, animal: true, known: true };
  }
  const spec = PROPS[kind] ?? FALLBACK;
  const t = texture(64, 64);
  spec.paint(pal, t, random(seed), { ...spec, ...tintOf(variant) });
  outline(t, P(pal, "ink"), spec.emit ? 0.3 : 0.6);
  return { tex: t, frames: null, ...sized(t, spec.h), emit: spec.emit ?? 0, lift: spec.lift ?? 0, known: Boolean(PROPS[kind]) };
}

/** Map tints (red, gold, indigo, green, kitchen) recolour robes and walls. */
function tintOf(variant) {
  const tint = { red: "#a85c43", gold: "#c9a14a", indigo: "#4c5f86", green: "#5d7b4b", kitchen: "#9a6a46" }[variant];
  return tint ? { robe: tint, color: tint } : {};
}

export const isPerson = (kind) => Boolean(PEOPLE[kind]);
export const isAnimal = (kind) => Boolean(ANIMALS[kind]);
export const knownProp = (kind) => Boolean(PROPS[kind]);

/** A head-and-shoulders crop of a sprite, for dialogue portraits. */
export function portraitOf(sprite) {
  const src = sprite.tex;
  // Find the top of the figure.
  let top = 0;
  outer: for (; top < src.h; top++) for (let x = 0; x < src.w; x++) if (src.data[top * src.w + x] >>> 24 > 127) break outer;
  const size = sprite.person ? 40 : src.w;
  const out = texture(size, size);
  const x0 = Math.round((src.w - size) / 2),
    y0 = sprite.person ? Math.max(0, top - 3) : 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out.data[y * size + x] = src.data[(y0 + y) * src.w + x0 + x] ?? 0;
  return out;
}

export { mirror };

// ── The hero's own hands ──────────────────────────────────────────────────
/** How each hero's hands look at the bottom of the screen. */
export const HANDS = {
  kweku: { skin: "skin", sleeve: "cloth3" },
  urashima: { skin: "skin", sleeve: "cloth2" },
  donkey: { hoof: "#4a4038", leg: "#8a8478" },
  cadi: { skin: "skin", sleeve: "cloth3" },
};

/** A right hand (or forehoof) reaching up from the bottom edge; mirror it for the left. */
export function handFor(tale, hero) {
  const pal = paletteOf(tale);
  const look = HANDS[hero] ?? HANDS.kweku;
  const t = texture(64, 64);
  if (look.hoof) {
    line(t, 40, 64, 30, 30, 16, rgb(look.leg));
    for (let y = 36; y < 64; y += 5) line(t, 30, y, 44, y - 2, 1, shade(rgb(look.leg), 0.8));
    ellipse(t, 29, 26, 10, 8, rgb(look.hoof), { light: 0.4 });
    return outline(t, P(pal, "ink"), 0.8);
  }
  const skin = P(pal, look.skin),
    sleeve = P(pal, look.sleeve);
  polygon(t, [[30, 64], [56, 64], [48, 40], [34, 38]], sleeve);
  line(t, 46, 40, 34, 26, 11, skin);
  ellipse(t, 30, 22, 9, 8, skin, { light: 0.45 });
  // Fingers curled toward the middle of the screen.
  for (let k = 0; k < 4; k++) ellipse(t, 22 + k * 2, 15 + k * 3.5, 3, 2.4, shade(skin, 0.95 - k * 0.04));
  ellipse(t, 37, 18, 3, 4, shade(skin, 1.08));
  return outline(t, P(pal, "ink"), 0.8);
}

/** The marker over anything you can look at, take or talk to. */
export function glintSprite(color = [243, 220, 154]) {
  const t = texture(16, 16);
  polygon(t, [[8, 0], [15, 8], [8, 16], [1, 8]], color);
  polygon(t, [[8, 3], [12, 8], [8, 13], [4, 8]], [255, 250, 230]);
  return { tex: t, frames: null, h: 0.24, w: 0.24, emit: 1, lift: 0 };
}
