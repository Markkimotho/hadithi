// What stands in a first-person scene, as data the renderer draws: the
// level's fixed things, the people of the map, and the lights that fires and
// lanterns throw. Pure; the world adds the moving parts (bodies, wanderers,
// companions) each frame.
import { castRay } from "./cast.js";
import { buildLevel } from "./scene.js";

/** Sprite key for a kind with an optional tint. */
export const spriteKey = (kind, tint) => (tint ? `${kind}|${tint}` : kind);

/** Fixed things of a level as renderable instances. */
export function sceneThings(level, layout, art, { time = 0 } = {}) {
  const out = [];
  for (const t of level.things) {
    const sprite = art.sprites.get(spriteKey(t.kind, t.tint));
    if (!sprite) continue;
    out.push({ id: `${t.kind}@${t.cell}`, kind: t.kind, item: t.item, sprite, x: t.x, y: t.y, z: sprite.lift ?? 0, frame: 0 });
  }
  for (const p of layout.people) {
    const sprite = art.sprites.get(spriteKey(p.kind, p.tint));
    if (!sprite) continue;
    // Idle people breathe: the second frame now and then, never in step.
    const frame = sprite.frames && Math.sin(time * 1.3 + p.at[0] * 3 + p.at[1]) > 0.97 ? 1 : 0;
    out.push({ id: p.id, kind: p.kind, sprite, x: p.at[0] + 0.5, y: p.at[1] + 0.5, z: p.perch ?? sprite.lift ?? 0, frame, person: true });
  }
  return out;
}

const WARM = [1.15, 0.72, 0.32];
const COOL = [0.75, 0.9, 1.1];

/** Fires, lamps and lit windows light what is near them, more as the day goes. */
export function sceneLights(level, layout, light, art = null) {
  const dark = 1 - light.day;
  if (dark < 0.15) return [];
  const lights = [];
  for (const t of level.things) {
    const glow = EMITTERS[t.kind];
    if (!glow) continue;
    lights.push({ x: t.x, y: t.y, color: glow.cool ? COOL : WARM, power: glow.power * dark });
  }
  // Too many lights cost frame time; keep the strongest few.
  return lights.sort((a, b) => b.power - a.power).slice(0, 8);
}
export const EMITTERS = {
  fire: { power: 1.3 },
  firepit: { power: 1.3 },
  hearthfire: { power: 1.5 },
  lantern: { power: 0.9 },
  lamp: { power: 0.8 },
  litwindow: { power: 0.6 },
  kitchenwindow: { power: 0.4 },
  fireflies: { power: 0.35, cool: false },
  distantlight: { power: 0.3 },
};

/**
 * Which way to face on arrival: toward the things to do, but never into a
 * wall. Each of 32 headings scores how far you can see across a small fan
 * (up to 10 m) plus how directly it faces the middle of the hotspots; the
 * best heading wins. So a scene opens on what matters and on open ground.
 */
export function facingFrom(layout, [sx, sy], solid = buildLevel(layout).solid) {
  const ox = sx + 0.5,
    oy = sy + 0.5;
  const spots = layout.spots ?? [];
  const points = spots.length ? spots.map((s) => s.at) : [[layout.width / 2, layout.height / 2]];
  let x = 0,
    y = 0;
  for (const [px, py] of points) {
    x += px + 0.5;
    y += py + 0.5;
  }
  x /= points.length;
  y /= points.length;
  const goal = Math.hypot(x - ox, y - oy) < 0.5 ? Math.atan2(layout.height / 2 - sy, layout.width / 2 - sx) : Math.atan2(y - oy, x - ox);
  const depth = (a) => {
    const hit = castRay(solid, ox, oy, Math.cos(a), Math.sin(a), 10);
    return hit ? hit.dist : 10;
  };
  let best = goal,
    bestScore = -Infinity;
  for (let i = 0; i < 32; i++) {
    const a = goal + (i / 32) * Math.PI * 2;
    const view = Math.min(depth(a - 0.3), depth(a), depth(a + 0.3));
    const score = view + 2.5 * Math.cos(a - goal);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return Math.atan2(Math.sin(best), Math.cos(best));
}
