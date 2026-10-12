// The geometry of the first-person view, ported from Bunker Run's render.c
// (sdl-c-raycasting) to plain JavaScript. Nothing here draws: it answers
// where walls are along each screen column, where a thing in the world lands
// on screen, what the crosshair is on, and how much light reaches a point.
// The renderer (render.js) and the gate tests both use it.
//
// World units are tiles (one metre). x grows east, y grows south, like the
// map files. An angle of 0 looks east; PI/2 looks south.

/** Half-width of the camera plane on a wide screen (about 66 degrees of view). */
export const PLANE = 0.66;
/** How far a ray travels before it gives up: past this is open country and fog. */
export const MAX_DEPTH = 40;
/** Walls stand this tall (metres; a tile is one metre across). */
export const WALL_H = 2.5;
/** A grown person's eye height. Each hero has their own (see tales.js). */
export const EYE = 1.5;

/** A camera at (x, y) looking along `angle`. Portrait screens narrow the plane so people keep their shape. */
export function camera(x, y, angle, aspect = 16 / 9) {
  const plane = Math.max(0.36, Math.min(PLANE, (PLANE * aspect) / 1.5));
  const dirX = Math.cos(angle),
    dirY = Math.sin(angle);
  return { x, y, angle, dirX, dirY, planeX: -dirY * plane, planeY: dirX * plane, plane };
}

/** Distance from the eye to the screen in pixels, for a screen `width` wide. */
export const focal = (cam, width) => width / 2 / cam.plane;

/**
 * Digital differential analysis: walk the grid along one ray until a wall.
 * Returns the perpendicular distance (no fisheye), which side was hit (0 for
 * an east or west face, 1 for north or south), the cell, and where along the
 * face the ray struck (0..1, already flipped so textures read left to right).
 * Returns null if the ray leaves the map and travels MAX_DEPTH without a wall.
 */
export function castRay(solid, ox, oy, rayX, rayY, maxDepth = MAX_DEPTH) {
  let mapX = Math.floor(ox),
    mapY = Math.floor(oy);
  const deltaX = rayX === 0 ? 1e30 : Math.abs(1 / rayX);
  const deltaY = rayY === 0 ? 1e30 : Math.abs(1 / rayY);
  const stepX = rayX < 0 ? -1 : 1,
    stepY = rayY < 0 ? -1 : 1;
  let sideX = rayX < 0 ? (ox - mapX) * deltaX : (mapX + 1 - ox) * deltaX;
  let sideY = rayY < 0 ? (oy - mapY) * deltaY : (mapY + 1 - oy) * deltaY;
  let side = 0;
  for (let i = 0; i < 512; i++) {
    if (sideX < sideY) {
      sideX += deltaX;
      mapX += stepX;
      side = 0;
    } else {
      sideY += deltaY;
      mapY += stepY;
      side = 1;
    }
    const dist = side === 0 ? sideX - deltaX : sideY - deltaY;
    if (dist > maxDepth) return null;
    if (solid(mapX, mapY)) {
      let wallX = side === 0 ? oy + dist * rayY : ox + dist * rayX;
      wallX -= Math.floor(wallX);
      // Flip so a texture is never mirrored, whichever face you look at.
      if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) wallX = 1 - wallX;
      return { dist: Math.max(dist, 1e-4), side, mapX, mapY, wallX };
    }
  }
  return null;
}

/**
 * Cast one ray per screen column. Fills `out` (reused between frames):
 * dist (Infinity where nothing was hit), side, mapX, mapY, wallX.
 */
export function castColumns(solid, cam, width, out = columnBuffers(width)) {
  for (let x = 0; x < width; x++) {
    const cx = (2 * x) / width - 1;
    const hit = castRay(solid, cam.x, cam.y, cam.dirX + cam.planeX * cx, cam.dirY + cam.planeY * cx);
    if (hit) {
      out.dist[x] = hit.dist;
      out.side[x] = hit.side;
      out.mapX[x] = hit.mapX;
      out.mapY[x] = hit.mapY;
      out.wallX[x] = hit.wallX;
    } else {
      out.dist[x] = Infinity;
      out.side[x] = 0;
      out.mapX[x] = -1;
      out.mapY[x] = -1;
      out.wallX[x] = 0;
    }
  }
  return out;
}

export function columnBuffers(width) {
  return {
    dist: new Float32Array(width),
    side: new Uint8Array(width),
    mapX: new Int16Array(width),
    mapY: new Int16Array(width),
    wallX: new Float32Array(width),
  };
}

/**
 * Where a point in the world lands on screen. `z` is height above the floor.
 * Returns null behind the eye. depth is the distance along the view direction,
 * the same measure the column distances use, so the two can be compared.
 */
export function project(cam, x, y, z, width, height, { horizon = height / 2, eye = EYE } = {}) {
  const rx = x - cam.x,
    ry = y - cam.y;
  const inv = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY);
  const tx = inv * (cam.dirY * rx - cam.dirX * ry);
  const depth = inv * (-cam.planeY * rx + cam.planeX * ry);
  if (depth <= 0.05) return null;
  const f = focal(cam, width);
  return {
    x: (width / 2) * (1 + tx / depth),
    y: horizon + ((eye - z) * f) / depth,
    depth,
    scale: f / depth,
  };
}

/** Distance to the floor seen on screen row `row` (below the horizon). */
export function floorDistance(row, cam, width, horizon, eye = EYE) {
  const below = row + 0.5 - horizon;
  return below <= 0 ? Infinity : (eye * focal(cam, width)) / below;
}

/** Distance to a ceiling WALL_H up, seen on row `row` (above the horizon). */
export function ceilingDistance(row, cam, width, horizon, eye = EYE) {
  const above = horizon - row - 0.5;
  return above <= 0 ? Infinity : ((WALL_H - eye) * focal(cam, width)) / above;
}

/**
 * What the crosshair rests on. Each target is { id, x, y, z, h, w } in world
 * units. A target counts if the centre of the screen falls inside its
 * projected box, it is within `reach`, and no wall stands in front of it.
 * Nearest wins. Returns the target and its distance, or null.
 */
export function aimAt(cam, targets, solid, { reach = 2.6, width = 320, height = 180, eye = EYE, horizon = height / 2 } = {}) {
  const cx = width / 2,
    cy = horizon;
  let best = null;
  for (const t of targets) {
    const distance = Math.hypot(t.x - cam.x, t.y - cam.y);
    if (distance > reach) continue;
    const foot = project(cam, t.x, t.y, t.z ?? 0, width, height, { eye, horizon });
    if (!foot) continue;
    // Generous boxes: you should not have to aim at a hen's beak.
    const half = Math.max(((t.w ?? 0.8) / 2) * foot.scale, width * 0.06);
    const top = foot.y - (t.h ?? 1) * foot.scale;
    if (cx < foot.x - half || cx > foot.x + half || cy < top - height * 0.05 || cy > foot.y + height * 0.05) continue;
    const wall = castRay(solid, cam.x, cam.y, t.x - cam.x, t.y - cam.y, distance);
    if (wall && wall.dist < 0.98 && !(wall.mapX === Math.floor(t.x) && wall.mapY === Math.floor(t.y))) continue;
    if (!best || distance < best.distance) best = { target: t, distance };
  }
  return best;
}

/** Turn `from` toward `to` by at most `rate` radians, the short way round. */
export function turnToward(from, to, rate) {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return Math.abs(d) <= rate ? to : from + Math.sign(d) * rate;
}

// ── Light ─────────────────────────────────────────────────────────────────
// Bunker Run lights a scene with three things: daylight that falls off
// gently with distance, a faint night ambient, and the torch: a cone in the
// middle of the screen that falls off with the square of distance. Fog then
// pulls far colours toward the sky.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * The look of each kind of light in the tales. day: how much sun (0..1);
 * tint: colour of that sun; torch: strength of the light you carry; fog:
 * colour far things fade into; density: how fast they fade; sky: top and
 * horizon colours.
 */
export const LIGHTS = {
  dawn: { day: 0.72, tint: [1.08, 0.9, 0.78], torch: 0, fog: [214, 170, 150], density: 0.045, sky: [[86, 98, 150], [236, 170, 128]] },
  day: { day: 1, tint: [1.02, 1, 0.94], torch: 0, fog: [196, 212, 214], density: 0.028, sky: [[92, 146, 196], [214, 226, 222]] },
  dusk: { day: 0.5, tint: [1.12, 0.8, 0.62], torch: 0.35, fog: [150, 96, 92], density: 0.05, sky: [[54, 44, 92], [222, 128, 82]] },
  night: { day: 0.06, tint: [0.7, 0.78, 1], torch: 1, fog: [10, 12, 22], density: 0.11, sky: [[6, 8, 20], [22, 28, 48]] },
  moon: { day: 0.2, tint: [0.72, 0.84, 1.12], torch: 0.8, fog: [30, 38, 62], density: 0.07, sky: [[10, 16, 40], [56, 70, 110]] },
  deep: { day: 0.42, tint: [0.56, 0.9, 1.04], torch: 0.45, fog: [18, 70, 92], density: 0.12, sky: [[8, 40, 70], [40, 120, 140]] },
  lamp: { day: 0.18, tint: [1.1, 0.86, 0.6], torch: 0.9, fog: [40, 26, 18], density: 0.08, sky: [[18, 12, 10], [60, 38, 24]] },
};
export const lightFor = (name) => LIGHTS[name] ?? LIGHTS.day;

/** Daylight reaching a surface at distance d; side 1 faces are a little darker. */
export function dayDiffuse(d, side = 0) {
  return clamp(1.06 / (1 + d * 0.05), 0.34, 1) * (side === 1 ? 0.76 : 1);
}
export function nightAmbient(d) {
  return 0.055 + 0.18 / (1 + d * 0.16);
}
/** The carried light: strongest in the middle of the screen (camX = 0). */
export function torchBeam(d, camX, strength = 1) {
  const cone = 1 - smoothstep(0.17, 0.64, Math.abs(camX));
  return (cone * 0.85 + 0.15) * (1 / (1 + 0.055 * d * d)) * strength;
}
/** How far a colour has faded into fog at distance d (0 none, 1 all fog). */
export function fogAmount(d, density) {
  return d === Infinity ? 1 : clamp(1 - Math.exp(-d * density), 0, 0.96);
}

/**
 * Brightness of a lit point as an [r, g, b] multiplier, before fog.
 * camX is the screen position from -1 (left edge) to 1 (right edge).
 */
export function lightAt(model, d, side, camX) {
  const sun = dayDiffuse(d, side) * model.day;
  const night = nightAmbient(d) * (1 - model.day) * (side === 1 ? 0.85 : 1);
  const torch = torchBeam(d, camX, model.torch);
  return [
    sun * model.tint[0] + night * 0.7 + torch * 1.18,
    sun * model.tint[1] + night * 0.78 + torch * 0.92,
    sun * model.tint[2] + night * 1 + torch * 0.62,
  ];
}
