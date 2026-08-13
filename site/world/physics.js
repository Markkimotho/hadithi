// Top-down physics on Planck (Box2D). One unit is one metre, one tile.
// Gravity is zero; damping stands in for floor friction. Height is a separate
// z value for carried and thrown things, with a shadow drawn on the ground.
//
// No Phaser here: the browser passes the Planck module in, and the gate
// tests and skill evals run the same code in Node.
import { tileAt, blockedTiles } from "./layout.js";

export const STEP = 1 / 60;
// drift: seconds of push a field adds to the velocity the player steers toward.
export const PLAYER = { radius: 0.3, walk: 3.6, run: 6, accel: 14, carrySlow: 0.72, drift: 0.3 };
const Z_GRAVITY = 20;

/** Physical character of each kind of loose prop. */
export const PROP_PHYSICS = {
  crate: { shape: "box", half: 0.4, density: 1.4, damping: 7, angular: 6, fragile: null, carry: false },
  jar: { shape: "circle", radius: 0.32, density: 2.2, damping: 6, angular: 8, fragile: 2.4, carry: true },
  pot: { shape: "circle", radius: 0.38, density: 3, damping: 6, angular: 8, fragile: 2.8, carry: true },
  light: { shape: "circle", radius: 0.22, density: 0.6, damping: 3, angular: 3, fragile: null, carry: true },
};

/** Merge solid tiles into as few rectangles as possible (greedy meshing). */
export function solidRects(layout) {
  const blocked = blockedTiles(layout);
  const solid = (x, y) => tileAt(layout, x, y).solid || blocked.has(`${x},${y}`);
  const used = new Set();
  const rects = [];
  for (let y = 0; y < layout.height; y++)
    for (let x = 0; x < layout.width; x++) {
      if (!solid(x, y) || used.has(`${x},${y}`)) continue;
      let w = 1;
      while (x + w < layout.width && solid(x + w, y) && !used.has(`${x + w},${y}`)) w++;
      let h = 1;
      grow: while (y + h < layout.height) {
        for (let i = 0; i < w; i++) if (!solid(x + i, y + h) || used.has(`${x + i},${y + h}`)) break grow;
        h++;
      }
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used.add(`${x + i},${y + j}`);
      rects.push({ x, y, w, h });
    }
  return rects;
}

/**
 * Build the physical world for one layout.
 * @param planck the Planck module
 * @param layout a parsed layout
 * @param start the player's tile
 */
export function createPhysics(planck, layout, start, { cracked = [] } = {}) {
  const world = new planck.World({ gravity: { x: 0, y: 0 } });
  const events = [];
  const ground = world.createBody({ type: "static" });
  // Outer bounds, so nothing leaves the map except through an exit.
  const W = layout.width,
    H = layout.height;
  for (const [cx, cy, hx, hy] of [
    [W / 2, -0.5, W / 2 + 1, 0.5],
    [W / 2, H + 0.5, W / 2 + 1, 0.5],
    [-0.5, H / 2, 0.5, H / 2 + 1],
    [W + 0.5, H / 2, 0.5, H / 2 + 1],
  ])
    ground.createFixture(new planck.Box(hx, hy, { x: cx, y: cy }, 0), { friction: 0.2, userData: "bounds" });
  for (const r of solidRects(layout))
    ground.createFixture(new planck.Box(r.w / 2, r.h / 2, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, 0), { friction: 0.3 });

  const player = world.createBody({
    type: "dynamic",
    position: { x: start[0] + 0.5, y: start[1] + 0.5 },
    fixedRotation: true,
    linearDamping: 0,
    bullet: true,
  });
  player.createFixture(new planck.Circle(PLAYER.radius), { density: 2.5, friction: 0 });
  player.setUserData({ kind: "player" });

  const props = [];
  for (const [index, p] of layout.props.entries()) {
    const spec = PROP_PHYSICS[p.physics];
    if (!spec) continue;
    const id = p.id ?? `${p.kind}${index}`;
    const body = world.createBody({
      type: "dynamic",
      position: { x: p.at[0] + 0.5, y: p.at[1] + 0.5 },
      linearDamping: spec.damping,
      angularDamping: spec.angular,
    });
    const shape = spec.shape === "box" ? new planck.Box(spec.half, spec.half) : new planck.Circle(spec.radius);
    body.createFixture(shape, { density: spec.density, friction: 0.4, restitution: 0.15 });
    const prop = { id, kind: p.kind, spec, body, z: 0, vz: 0, carried: false, cracked: cracked.includes(id), source: p };
    body.setUserData(prop);
    props.push(prop);
  }

  // Hard knocks crack fragile things. Impulse is in N·s on a ~1-4 kg body.
  world.on("post-solve", (contact, impulse) => {
    const hit = Math.max(...impulse.normalImpulses.slice(0, contact.getManifold().pointCount || 1));
    for (const body of [contact.getFixtureA().getBody(), contact.getFixtureB().getBody()]) {
      const prop = body.getUserData();
      if (!prop || prop.kind === "player" || !prop.spec) continue;
      if (hit > 0.6) events.push({ type: "knock", prop, impulse: hit });
      if (prop.spec.fragile && !prop.cracked && hit > prop.spec.fragile) {
        prop.cracked = true;
        events.push({ type: "crack", prop, impulse: hit });
      }
    }
  });

  const intent = { x: 0, y: 0, run: false };
  let carrying = null;
  let wind = { x: layout.wind?.[0] ?? 0, y: layout.wind?.[1] ?? 0 };
  const flows = (layout.flows ?? []).map((f) => ({ ...f }));
  let clock = 0;

  function slowAt(x, y) {
    return tileAt(layout, Math.floor(x), Math.floor(y)).slow ?? 1;
  }

  function step() {
    clock += STEP;
    // Wind and currents: a push on loose bodies, and a drift the player cannot
    // fully steer against (they lean into it, but a squall still moves them).
    const gust = wind.x || wind.y ? 0.65 + 0.35 * Math.sin(clock * 1.7) * Math.sin(clock * 0.53 + 1) : 0;
    const field = (at) => {
      let fx = wind.x * gust,
        fy = wind.y * gust;
      for (const f of flows) {
        const [x, y, w, h] = f.rect;
        if (at.x >= x && at.x < x + w && at.y >= y && at.y < y + h) {
          fx += f.force[0];
          fy += f.force[1];
        }
      }
      return [fx, fy];
    };
    for (const prop of props) {
      if (prop.carried) continue;
      const [fx, fy] = field(prop.body.getPosition());
      if (fx || fy) prop.body.applyForceToCenter({ x: fx * prop.body.getMass(), y: fy * prop.body.getMass() }, true);
    }
    // Player: steer velocity toward the intent plus drift; ground and load slow it.
    const p = player.getPosition();
    const len = Math.hypot(intent.x, intent.y);
    const dir = len > 1 ? { x: intent.x / len, y: intent.y / len } : intent;
    const speed = (intent.run ? PLAYER.run : PLAYER.walk) * slowAt(p.x, p.y) * (carrying ? PLAYER.carrySlow : 1);
    const [dx, dy] = field(p);
    const v = player.getLinearVelocity();
    const want = { x: dir.x * speed + dx * PLAYER.drift, y: dir.y * speed + dy * PLAYER.drift };
    const k = Math.min(1, PLAYER.accel * STEP);
    const m = player.getMass();
    player.applyLinearImpulse({ x: (want.x - v.x) * k * m, y: (want.y - v.y) * k * m }, p, true);
    world.step(STEP);
    // Height for carried and thrown props.
    for (const prop of props) {
      if (prop.carried) {
        const at = player.getPosition();
        prop.body.setPosition({ x: at.x, y: at.y });
        prop.z = 1.1;
        continue;
      }
      if (prop.z > 0 || prop.vz > 0) {
        prop.vz -= Z_GRAVITY * STEP;
        prop.z += prop.vz * STEP;
        if (prop.z <= 0) {
          const impact = -prop.vz;
          prop.z = 0;
          prop.vz = impact > 2.5 ? impact * 0.3 : 0;
          events.push({ type: "land", prop, impulse: impact * prop.body.getMass() });
          if (prop.spec.fragile && !prop.cracked && impact > prop.spec.fragile * 2) {
            prop.cracked = true;
            events.push({ type: "crack", prop, impulse: impact });
          }
        }
      }
    }
  }

  /** Nearest loose prop within reach that can be lifted. */
  function liftable(reach = 1.1) {
    const at = player.getPosition();
    let best = null;
    for (const prop of props) {
      if (!prop.spec.carry || prop.carried || prop.z > 0) continue;
      const d = Math.hypot(prop.body.getPosition().x - at.x, prop.body.getPosition().y - at.y);
      if (d <= reach && (!best || d < best.d)) best = { prop, d };
    }
    return best?.prop ?? null;
  }

  return {
    world,
    player,
    props,
    events,
    setIntent(x, y, run = false) {
      intent.x = x;
      intent.y = y;
      intent.run = run;
    },
    setWind(x, y) {
      wind = { x, y };
    },
    get carrying() {
      return carrying;
    },
    liftable,
    lift(prop = liftable()) {
      if (!prop || carrying) return null;
      carrying = prop;
      prop.carried = true;
      prop.body.setActive(false);
      return prop;
    },
    /** Throw (or set down, with power 0) what you carry, toward `facing`. */
    throw(facing, power = 1) {
      if (!carrying) return null;
      const prop = carrying;
      carrying = null;
      prop.carried = false;
      const at = player.getPosition();
      const reach = PLAYER.radius + (prop.spec.radius ?? prop.spec.half) + 0.08;
      prop.body.setPosition({ x: at.x + facing.x * reach, y: at.y + facing.y * reach });
      prop.body.setActive(true);
      const v = player.getLinearVelocity();
      prop.body.setLinearVelocity({ x: v.x + facing.x * 6.5 * power, y: v.y + facing.y * 6.5 * power });
      prop.z = power ? 1.1 : 0;
      prop.vz = power ? 3 * power : 0;
      return prop;
    },
    /** Move the player (scene arrival, or a shared-ground hop). */
    place([x, y]) {
      player.setPosition({ x: x + 0.5, y: y + 0.5 });
      player.setLinearVelocity({ x: 0, y: 0 });
    },
    step,
    /** Advance real time with a fixed step; returns the leftover fraction. */
    advance(dt, carry = 0) {
      let acc = carry + Math.min(dt, 0.1);
      while (acc >= STEP) {
        step();
        acc -= STEP;
      }
      return acc;
    },
    tile() {
      const p = player.getPosition();
      return [Math.floor(p.x), Math.floor(p.y)];
    },
  };
}
