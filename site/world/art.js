// Temporary vector scenery for the runtime slice. The later art/rig phase
// replaces these drawing functions without changing story or physics code.
export const TILE = 40;
export const TILE_FRAME = { ".": 0, ",": 1, '"': 2, ":": 3, _: 4, "~": 5, w: 6, "+": 7, s: 8, r: 9, m: 10, "#": 11, "=": 12, o: 13, T: 14, b: 15, h: 16, " ": 17 };

export function drawGround(scene, layout, atlas = "wisdom-tiles") {
  const ground = scene.add.container(0, 0).setDepth(-100);
  layout.grid.forEach((row, y) => row.forEach((tile, x) => {
    const frame = TILE_FRAME[tile] ?? TILE_FRAME[" "];
    const image = scene.add.image(x * TILE, y * TILE, atlas, frame).setOrigin(0).setDisplaySize(TILE, TILE);
    ground.add(image);
  }));
  return ground;
}

export function drawProp(scene, p) {
  const g = scene.add.graphics();
  const w = (p.w ?? 1) * TILE, h = (p.h ?? 1) * TILE;
  g.fillStyle(0x282e20, 0.25).fillEllipse(w / 2 - 12, h - 14, w + 10, 24);
  if (p.kind === "hut") {
    g.fillStyle(0xb37e50).fillRect(-15, -5, w, h - 12);
    g.fillStyle(0x614332).fillRect(w / 2 - 28, h - 63, 30, 46);
    g.fillStyle(0x8e6544).fillTriangle(-27, 5, w + 2, 5, w / 2 - 10, -55);
    g.lineStyle(3, 0xc7a06a, 0.7);
    for (let x = 0; x < w; x += 12) g.lineBetween(w / 2 - 10, -50, x - 16, 3);
  } else if (p.kind === "stall") {
    g.fillStyle(0x624c36).fillRect(-12, -8, w - 8, h - 12);
    g.fillStyle({ red: 0xa85c43, gold: 0xc1a05a, indigo: 0x536375, green: 0x63794c }[p.tint] ?? 0xb1804d).fillRect(-20, -30, w + 10, h - 12);
    g.lineStyle(3, 0xead3a0, 0.5);
    for (let x = 0; x < w; x += 16) g.lineBetween(x - 14, -30, x - 14, h - 42);
  } else if (p.kind === "jar" || p.kind === "pot") {
    g.fillStyle(0x82533c).fillEllipse(0, -9, 27, 32);
    g.fillStyle(0xc29064).fillEllipse(-3, -12, 20, 27);
    g.fillStyle(0x593f31).fillEllipse(0, -27, 15, 7);
  } else if (p.kind === "well" || p.kind === "firepit" || p.kind === "potring") {
    g.fillStyle(0xc1a374).fillEllipse(0, 0, 43, 27);
    g.fillStyle(0x4e4837).fillEllipse(0, -4, 29, 16);
    if (p.kind === "well") {
      g.lineStyle(5, 0x614936).lineBetween(-19, -10, -19, -56).lineBetween(19, -10, 19, -56).lineBetween(-23, -56, 23, -56);
      g.lineStyle(2, 0xd1b582).lineBetween(0, -56, 0, -4);
    }
  } else if (p.kind === "leaves") {
    g.fillStyle(0x667248).fillEllipse(0, 0, 20, 8).fillEllipse(10, 9, 14, 6);
  } else if (p.kind === "cloth") {
    g.fillStyle(0xcbba86).fillRoundedRect(-16, -10, 32, 20, 3);
    g.lineStyle(3, 0x945e42).lineBetween(-12, -4, 12, -4);
  } else if (p.kind === "gourd") {
    g.fillStyle(0xc39e59).fillCircle(0, 0, 12).fillCircle(0, -10, 7);
  } else {
    g.fillStyle(0xa17b4e).fillRect(-15, -20, Math.max(30, w - 8), Math.max(25, h - 15));
    g.lineStyle(2, 0x66523b).strokeRect(-15, -20, Math.max(30, w - 8), Math.max(25, h - 15));
    g.lineBetween(-14, -19, 14, 9).lineBetween(14, -19, -14, 9);
  }
  return g;
}

export function drawPerson(scene, kind = "player") {
  const g = scene.add.graphics();
  g.fillStyle(0x233224, 0.3).fillEllipse(0, 2, 27, 12);
  if (kind === "hen") {
    g.fillStyle(0xe1c89c).fillEllipse(0, -8, 22, 17).fillCircle(7, -16, 6);
    g.fillStyle(0xa35236).fillTriangle(8, -22, 14, -24, 13, -17);
  } else {
    g.lineStyle(6, 0x513a2c).lineBetween(-5, -9, -6, 0).lineBetween(5, -9, 6, 0);
    g.fillStyle(kind === "player" ? 0xe0ba69 : kind === "potter" ? 0x8096a0 : 0xa77a66).fillRoundedRect(-10, -29, 20, 22, 5);
    g.lineStyle(5, 0x78513a).lineBetween(-11, -23, -14, -11).lineBetween(11, -23, 14, -11);
    g.fillStyle(0x85573c).fillCircle(0, -36, 9);
    g.fillStyle(0x302d25).fillEllipse(0, -42, 18, 10);
    if (kind === "player") g.fillStyle(0xede0a9).fillRect(-7, -23, 14, 4);
  }
  return g;
}
