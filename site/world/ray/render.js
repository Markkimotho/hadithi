// The software renderer: one frame into a pixel buffer. Bunker Run's draw
// order, in JavaScript:
//
//   1. sky (or ceiling) and floor, row by row
//   2. walls, column by column, filling the depth buffer
//   3. shadows under things, then the things themselves, far to near,
//      each column tested against the depth buffer
//
// Light is worked out per row (floors), per column (walls) and per thing
// (sprites) from cast.js: daylight, night ambient, the torch cone, fog, and
// point lights from fires and lanterns. No DOM here: the browser hands in an
// ImageData buffer, the gate tests hand in a plain one.
import { castColumns, columnBuffers, focal, project, dayDiffuse, nightAmbient, fogAmount, EYE, WALL_H } from "./cast.js";
import { FLOWING, SKY_W, SKY_H } from "./textures.js";

/** Things nearer the eye than this are not drawn. */
export const NEAREST = 0.3;
const clamp255 = (v) => (v > 255 ? 255 : v < 0 ? 0 : v | 0);

/** A frame buffer and the per-column scratch the renderer reuses. */
export function createTarget(width, height) {
  return {
    w: width,
    h: height,
    data: new Uint32Array(width * height),
    zbuf: new Float32Array(width),
    columns: columnBuffers(width),
    cone: new Float32Array(width),
  };
}

/** Per-cell texture lookups for a level, built once per scene. */
export function prepareLevel(level, art) {
  const { width, height } = level;
  const wallTex = level.walls.map((k) => (k ? art.walls.get(k) : null));
  const floorTex = level.floors.map((k) => art.floors.get(k));
  const flowing = level.floors.map((k) => FLOWING.has(k[0]));
  return {
    level,
    art,
    wallAt: (x, y) => wallTex[y * width + x],
    floorIndex(x, y) {
      const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
      const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
      return cy * width + cx;
    },
    floorTex,
    flowing,
  };
}

/**
 * For each column of a texture, the first and last row with paint in it
 * (first > last if the column is clear). Cached on the texture.
 */
export function opaqueRows(tex) {
  if (tex.opaque) return tex.opaque;
  const out = new Int16Array(tex.w * 2);
  for (let x = 0; x < tex.w; x++) {
    let first = tex.h,
      last = -1;
    for (let y = 0; y < tex.h; y++)
      if (tex.data[y * tex.w + x] >>> 24 >= 128) {
        if (y < first) first = y;
        last = y;
      }
    out[x * 2] = first;
    out[x * 2 + 1] = last;
  }
  tex.opaque = out;
  return out;
}

/** Light map cells per metre. */
export const LIGHTMAP_RES = 4;

/** The sum of every point light, sampled on a grid over the level. Cached until the lights change. */
export function lightMap(prepared, lamps) {
  const key = lamps.map((l) => `${l.x},${l.y},${l.power},${l.color}`).join(";");
  if (prepared.lightMap?.key === key) return prepared.lightMap;
  const w = prepared.level.width * LIGHTMAP_RES,
    h = prepared.level.height * LIGHTMAP_RES;
  const data = new Float32Array(w * h * 3);
  for (let gy = 0; gy < h; gy++)
    for (let gx = 0; gx < w; gx++) {
      const px = (gx + 0.5) / LIGHTMAP_RES,
        py = (gy + 0.5) / LIGHTMAP_RES;
      const i = (gy * w + gx) * 3;
      for (const l of lamps) {
        const dx = px - l.x,
          dy = py - l.y;
        const k = l.power / (1 + (dx * dx + dy * dy) * 0.9);
        data[i] += l.color[0] * k;
        data[i + 1] += l.color[1] * k;
        data[i + 2] += l.color[2] * k;
      }
    }
  prepared.lightMap = { key, w, h, data };
  return prepared.lightMap;
}

/**
 * Draw one frame.
 * @param target   from createTarget
 * @param prepared from prepareLevel
 * @param cam      from camera()
 * @param view     { light (a LIGHTS model), time (seconds), horizon (px offset), eye (metres),
 *                   things: [{ sprite, x, y, z, frame, flip, shadow, glow, highlight }],
 *                   lights: [{ x, y, color: [r,g,b], power }] }
 */
export function renderFrame(target, prepared, cam, view) {
  const { w: W, h: H, data, zbuf, cone } = target;
  const { level, art } = prepared;
  const light = view.light;
  const eye = view.eye ?? EYE;
  const horizon = H / 2 + (view.horizon ?? 0);
  const f = focal(cam, W);
  const time = view.time ?? 0;
  const lamps = view.lights ?? [];
  const torch = light.torch;
  const [fogR, fogG, fogB] = light.fog;
  for (let x = 0; x < W; x++) {
    const camX = (2 * x) / W - 1;
    const t = Math.min(1, Math.max(0, (Math.abs(camX) - 0.17) / 0.47));
    cone[x] = ((1 - t * t * (3 - 2 * t)) * 0.85 + 0.15) * torch;
  }
  // Point lights add warm colour that falls off with distance. They don't
  // move, so their sum is baked once into a light map and each pixel reads it.
  const map = lamps.length ? lightMap(prepared, lamps) : null;
  const lampAt = (px, py, out) => {
    const gx = Math.floor(px * LIGHTMAP_RES),
      gy = Math.floor(py * LIGHTMAP_RES);
    if (gx < 0 || gy < 0 || gx >= map.w || gy >= map.h) {
      out[0] = out[1] = out[2] = 0;
      return;
    }
    const i = (gy * map.w + gx) * 3;
    out[0] = map.data[i];
    out[1] = map.data[i + 1];
    out[2] = map.data[i + 2];
  };
  const lamp = [0, 0, 0];
  const sunR = light.day * light.tint[0],
    sunG = light.day * light.tint[1],
    sunB = light.day * light.tint[2];
  const night = 1 - light.day;

  // ── 1. Sky or ceiling, and floor ─────────────────────────────────────────
  const [top, bottom] = light.sky;
  const sky = art.skyline;
  const skyRows = Math.max(1, Math.round((SKY_H * H) / 240));
  const leftX = cam.dirX - cam.planeX,
    leftY = cam.dirY - cam.planeY;
  const spanX = 2 * cam.planeX,
    spanY = 2 * cam.planeY;
  const ceiling = level.indoor ? art.ceiling : null;
  const starry = light.day < 0.25 && !level.indoor;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    const below = y + 0.5 - horizon;
    if (below <= 0 && !ceiling) {
      // Sky: gradient to the horizon, then the far skyline in fog colour.
      const k = Math.max(0, Math.min(1, (y - (horizon - H * 0.6)) / (H * 0.6)));
      const sr = top[0] + (bottom[0] - top[0]) * k,
        sg = top[1] + (bottom[1] - top[1]) * k,
        sb = top[2] + (bottom[2] - top[2]) * k;
      const sky0 = horizon - skyRows;
      for (let x = 0; x < W; x++) {
        let r = sr,
          g = sg,
          b = sb;
        if (y >= sky0) {
          const angle = cam.angle + Math.atan(((2 * x) / W - 1) * cam.plane);
          const u = ((((angle / (Math.PI * 2)) * SKY_W * 2) % SKY_W) + SKY_W) % SKY_W | 0;
          const v = (((y - sky0) / skyRows) * SKY_H) | 0;
          const c = sky.data[v * SKY_W + u];
          if (c >>> 24 > 127) {
            const mixK = 0.45 + 0.4 * (1 - light.day);
            r = (c & 255) * (1 - mixK) * (0.4 + light.day * 0.6) + fogR * mixK;
            g = ((c >>> 8) & 255) * (1 - mixK) * (0.4 + light.day * 0.6) + fogG * mixK;
            b = ((c >>> 16) & 255) * (1 - mixK) * (0.4 + light.day * 0.6) + fogB * mixK;
          }
        } else if (starry && ((x * 7919 + y * 104729) % 997) === 0) r = g = b = 200 + ((x * y) % 55);
        data[row + x] = 0xff000000 | (clamp255(b) << 16) | (clamp255(g) << 8) | clamp255(r);
      }
      continue;
    }
    // Floor below the horizon, ceiling above it indoors.
    const isFloor = below > 0;
    const dist = isFloor ? (eye * f) / below : ((WALL_H - eye) * f) / -below;
    const fog = fogAmount(dist, light.density);
    const day = dayDiffuse(dist, 0) * 0.92;
    const amb = nightAmbient(dist) * night;
    const fall = 1 / (1 + 0.055 * dist * dist);
    const lr = (sunR * day + amb * 0.7) * (isFloor ? 1 : 0.7),
      lg = (sunG * day + amb * 0.78) * (isFloor ? 1 : 0.7),
      lb = (sunB * day + amb) * (isFloor ? 1 : 0.7);
    let fx = cam.x + dist * leftX,
      fy = cam.y + dist * leftY;
    const stepX = (dist * spanX) / W,
      stepY = (dist * spanY) / W;
    const flow = time * 0.18;
    let lastCell = -1,
      tex = null,
      moving = false;
    for (let x = 0; x < W; x++, fx += stepX, fy += stepY) {
      const cx = Math.floor(fx),
        cy = Math.floor(fy);
      let u, v;
      if (isFloor) {
        const cell = prepared.floorIndex(cx, cy);
        if (cell !== lastCell) {
          lastCell = cell;
          tex = prepared.floorTex[cell];
          moving = prepared.flowing[cell];
        }
        u = fx - cx;
        v = fy - cy;
        if (moving) {
          u = (u + flow + Math.sin(fy * 2 + time) * 0.05) % 1;
          v = (v + flow * 0.4) % 1;
        }
      } else {
        tex = ceiling;
        u = fx - cx;
        v = fy - cy;
      }
      const c = tex.data[(((v * tex.h) | 0) & (tex.h - 1)) * tex.w + (((u * tex.w) | 0) & (tex.w - 1))];
      let mr = lr + cone[x] * fall * 1.18,
        mg = lg + cone[x] * fall * 0.92,
        mb = lb + cone[x] * fall * 0.62;
      if (lamps.length) {
        lampAt(fx, fy, lamp);
        mr += lamp[0];
        mg += lamp[1];
        mb += lamp[2];
      }
      const keep = 1 - fog;
      data[row + x] =
        0xff000000 |
        (clamp255(((c >>> 16) & 255) * mb * keep + fogB * fog) << 16) |
        (clamp255(((c >>> 8) & 255) * mg * keep + fogG * fog) << 8) |
        clamp255((c & 255) * mr * keep + fogR * fog);
    }
  }

  // ── 2. Walls ─────────────────────────────────────────────────────────────
  const cols = castColumns(level.solid, cam, W, target.columns);
  let wallColumns = 0;
  for (let x = 0; x < W; x++) {
    const dist = cols.dist[x];
    zbuf[x] = dist;
    if (dist === Infinity) continue;
    wallColumns++;
    const tex = prepared.wallAt(cols.mapX[x], cols.mapY[x]);
    const span = (WALL_H * f) / dist;
    const top = horizon + ((eye - WALL_H) * f) / dist;
    const y0 = Math.max(0, Math.ceil(top)),
      y1 = Math.min(H, Math.ceil(top + span));
    const side = cols.side[x];
    const fog = fogAmount(dist, light.density);
    const day = dayDiffuse(dist, side);
    const amb = nightAmbient(dist) * night * (side ? 0.85 : 1);
    const fall = cone[x] / (1 + 0.055 * dist * dist);
    let mr = sunR * day + amb * 0.7 + fall * 1.18,
      mg = sunG * day + amb * 0.78 + fall * 0.92,
      mb = sunB * day + amb + fall * 0.62;
    if (lamps.length) {
      const camX = (2 * x) / W - 1;
      lampAt(cam.x + (cam.dirX + cam.planeX * camX) * dist, cam.y + (cam.dirY + cam.planeY * camX) * dist, lamp);
      mr += lamp[0] * (side ? 0.8 : 1);
      mg += lamp[1] * (side ? 0.8 : 1);
      mb += lamp[2] * (side ? 0.8 : 1);
    }
    const keep = 1 - fog;
    const tx = Math.min(tex.w - 1, (cols.wallX[x] * tex.w) | 0);
    const step = tex.h / span;
    let ty = (y0 - top) * step;
    for (let y = y0; y < y1; y++, ty += step) {
      const c = tex.data[Math.min(tex.h - 1, ty | 0) * tex.w + tx];
      data[y * W + x] =
        0xff000000 |
        (clamp255(((c >>> 16) & 255) * mb * keep + fogB * fog) << 16) |
        (clamp255(((c >>> 8) & 255) * mg * keep + fogG * fog) << 8) |
        clamp255((c & 255) * mr * keep + fogR * fog);
    }
  }

  // ── 3. Things ────────────────────────────────────────────────────────────
  const placed = [];
  for (const thing of view.things ?? []) {
    const foot = project(cam, thing.x, thing.y, thing.z ?? 0, W, H, { horizon, eye });
    // Too far to matter, or so close you are standing in it (a stone underfoot
    // would otherwise fill the screen).
    if (!foot || foot.depth > 34 || foot.depth < NEAREST) continue;
    placed.push({ thing, foot });
  }
  placed.sort((a, b) => b.foot.depth - a.foot.depth);
  // Shadows first, so no thing's shadow falls across a nearer thing.
  for (const { thing, foot } of placed) {
    if (thing.shadow === false) continue;
    const ground = project(cam, thing.x, thing.y, 0, W, H, { horizon, eye });
    if (!ground) continue;
    const rx = (thing.sprite.w * 0.36 * ground.scale) | 0,
      ry = Math.max(1, (rx * 0.22) | 0);
    const lift = Math.max(0, thing.z ?? 0);
    const dark = 0.62 + Math.min(0.3, lift * 0.25);
    for (let y = Math.max(0, (ground.y - ry) | 0); y < Math.min(H, ground.y + ry); y++)
      for (let x = Math.max(0, (ground.x - rx) | 0); x < Math.min(W, ground.x + rx); x++) {
        if (ground.depth >= zbuf[x]) continue;
        const dx = (x - ground.x) / rx,
          dy = (y - ground.y) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const i = y * W + x,
          c = data[i];
        data[i] = 0xff000000 | ((((c >>> 16) & 255) * dark) << 16) | ((((c >>> 8) & 255) * dark) << 8) | ((c & 255) * dark);
      }
  }
  let drawn = 0;
  for (const { thing, foot } of placed) {
    const s = thing.sprite;
    const tex = (s.frames && s.frames[thing.frame | 0]) || s.tex;
    const height = s.h * foot.scale,
      width = s.w * foot.scale;
    const left = foot.x - width / 2,
      topY = foot.y - height;
    const x0 = Math.max(0, Math.floor(left)),
      x1 = Math.min(W, Math.ceil(left + width));
    const y0 = Math.max(0, Math.floor(topY)),
      y1 = Math.min(H, Math.ceil(foot.y));
    if (x0 >= x1 || y0 >= y1) continue;
    const d = foot.depth;
    const fog = fogAmount(d, light.density);
    const day = dayDiffuse(d, 0);
    const amb = nightAmbient(d) * night;
    const fall = 1 / (1 + 0.055 * d * d);
    if (lamps.length) lampAt(thing.x, thing.y, lamp);
    else lamp[0] = lamp[1] = lamp[2] = 0;
    const glow = Math.max(s.emit ?? 0, thing.glow ?? 0);
    const bright = thing.highlight ? 1.22 : 1;
    const keep = 1 - fog * (1 - glow * 0.7);
    let any = false;
    for (let x = x0; x < x1; x++) {
      if (d >= zbuf[x]) continue;
      let u = (((x + 0.5 - left) / width) * tex.w) | 0;
      if (u < 0 || u >= tex.w) continue;
      if (thing.flip) u = tex.w - 1 - u;
      let mr = (sunR * day + amb * 0.7 + cone[x] * fall * 1.18 + lamp[0]) * bright,
        mg = (sunG * day + amb * 0.78 + cone[x] * fall * 0.92 + lamp[1]) * bright,
        mb = (sunB * day + amb + cone[x] * fall * 0.62 + lamp[2]) * bright;
      if (glow) {
        mr = mr + (1.1 - mr) * glow;
        mg = mg + (1.05 - mg) * glow;
        mb = mb + (1 - mb) * glow;
      }
      const fk = fog * (1 - glow * 0.7);
      // Only the rows of this texture column that have paint in them.
      const span = opaqueRows(tex);
      const first = span[u * 2],
        last = span[u * 2 + 1];
      if (first > last) continue;
      const step = height / tex.h;
      const ya = Math.max(y0, Math.floor(topY + first * step)),
        yb = Math.min(y1, Math.ceil(topY + (last + 1) * step));
      const vStep = tex.h / height;
      let vf = (ya + 0.5 - topY) * vStep;
      for (let y = ya; y < yb; y++, vf += vStep) {
        const v = vf | 0;
        if (v < first || v > last) continue;
        const c = tex.data[v * tex.w + u];
        if (c >>> 24 < 128) continue;
        any = true;
        data[y * W + x] =
          0xff000000 |
          (clamp255(((c >>> 16) & 255) * mb * keep + fogB * fk) << 16) |
          (clamp255(((c >>> 8) & 255) * mg * keep + fogG * fk) << 8) |
          clamp255((c & 255) * mr * keep + fogR * fk);
      }
    }
    if (any) drawn++;
  }
  return { wallColumns, things: drawn, horizon };
}

/** Darken the edges of the frame, as a lens does (and as Bunker Run does). */
export function vignette(target, strength = 0.35) {
  const { w: W, h: H, data } = target;
  for (let y = 0; y < H; y++) {
    const dy = (y / H - 0.5) * 2;
    for (let x = 0; x < W; x++) {
      const dx = (x / W - 0.5) * 2;
      const d = dx * dx * 0.6 + dy * dy * 0.8;
      if (d < 0.35) continue;
      const k = 1 - Math.min(1, (d - 0.35) * strength);
      const i = y * W + x,
        c = data[i];
      data[i] = 0xff000000 | ((((c >>> 16) & 255) * k) << 16) | ((((c >>> 8) & 255) * k) << 8) | ((c & 255) * k);
    }
  }
}

/**
 * Draw a texture straight onto the frame, scaled, for things that are not in
 * the world: the hero's hands and what they carry. mul tints it by the light.
 */
export function blit(target, tex, x, y, w, h, { flip = false, mul = [1, 1, 1] } = {}) {
  const { w: W, h: H, data } = target;
  const x0 = Math.max(0, Math.floor(x)),
    x1 = Math.min(W, Math.ceil(x + w));
  const y0 = Math.max(0, Math.floor(y)),
    y1 = Math.min(H, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    const v = (((py + 0.5 - y) / h) * tex.h) | 0;
    if (v < 0 || v >= tex.h) continue;
    for (let px = x0; px < x1; px++) {
      let u = (((px + 0.5 - x) / w) * tex.w) | 0;
      if (u < 0 || u >= tex.w) continue;
      if (flip) u = tex.w - 1 - u;
      const c = tex.data[v * tex.w + u];
      if (c >>> 24 < 128) continue;
      data[py * W + px] =
        0xff000000 | (clamp255(((c >>> 16) & 255) * mul[2]) << 16) | (clamp255(((c >>> 8) & 255) * mul[1]) << 8) | clamp255((c & 255) * mul[0]);
    }
  }
}
