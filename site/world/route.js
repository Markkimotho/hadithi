// Following a walked route: which way to push, and when a waypoint counts as
// reached. Pure, so it is tested against real currents in Node.
export const ARRIVE = 0.24;
export const MIN_PUSH = 0.7;

/**
 * Intent toward the next waypoint. Eases in near it, but never below
 * MIN_PUSH: slower than that, a current or a gust can hold you short of it.
 * @returns {{x:number, y:number, arrived:boolean}}
 */
export function routeIntent(pos, waypoint) {
  const dx = waypoint.x - pos.x,
    dy = waypoint.y - pos.y;
  const distance = Math.hypot(dx, dy);
  if (distance < ARRIVE) return { x: 0, y: 0, arrived: true, distance };
  const push = Math.max(MIN_PUSH, Math.min(1, distance / 0.4));
  return { x: (dx / distance) * push, y: (dy / distance) * push, arrived: false, distance };
}
