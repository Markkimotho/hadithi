// The playable world, in first person. It owns physics, the camera, the
// people and things of a scene, and the frame on screen. It never writes
// story state: it reports what you face and where things are to the play
// shell (events) and asks for story actions through the bridge.
//
// One frame:
//   input → turn and intent → Planck step (fixed 60 Hz) → people, companions
//   and loose things move → raycast render (ray/render.js) into a low-res
//   buffer → hands → the buffer is scaled up, pixel-sharp, to fill the screen.
import { createPhysics } from "./physics.js";
import { blockedTiles, findPath, spawnFor, walkable } from "./layout.js";
import { createInput, TURN_SPEED } from "./input.js";
import { heroOf, eyeOf, followersOf, TALE_WORLD } from "./tales.js";
import { playTrial } from "./trials/stage.js";
import { routeIntent } from "./route.js";
import { layoutsFor } from "./layouts/index.js";
import { mountWeather } from "../ui/atmosphere.js";
import { camera, aimAt, project as projectPoint, turnToward } from "./ray/cast.js";
import { lightModel } from "./lightmodel.js";
import { buildLevel, worldArtFor } from "./ray/scene.js";
import { createTarget, prepareLevel, renderFrame, vignette, blit } from "./ray/render.js";
import { sceneLights, facingFrom, spriteKey } from "./ray/things.js";
import { handFor, glintSprite, portraitOf } from "./ray/sprites.js";

/** How the hero acts each kind of story action out before the story answers. */
const GESTURE = { INSPECT: "kneel", USE_ITEM: "kneel", TAKE_ITEM: "reach", TALK: "talk", BARGAIN: "talk", CHOOSE: "talk", SOLVE: "reach", WAIT: "kneel" };
/** Frame heights the renderer steps between to hold its frame rate. */
const QUALITY = [360, 300, 250, 210];
/** Weather the renderer draws as fog, not as a layer over the view. */
export const FOGGED = new Set(["mist", "dust"]);
/** How close something must be to act on it. */
const REACH = 2.4;

/**
 * @param bridge  story boundary (see bridge.js)
 * @param root    the play shell element (the joystick lives inside it)
 * @param paused  () => true while a dialog, the journal or a page covers play
 * @param busy    () => true while a trial runs
 * @param events  onReady, onPlaces, onNear, onConverse, onAdvance, onMessage, onMove, onFrame, onImpact
 */
export function createWorld({ bridge, root, paused, busy, events, motion, onError }) {
  const stage = document.createElement("div");
  stage.className = "world-stage";
  stage.innerHTML = `<canvas class="world-view" aria-hidden="true"></canvas><canvas class="world-overlay" aria-hidden="true"></canvas><div class="world-light-layer" aria-hidden="true"></div><canvas class="weather-layer world-weather" aria-hidden="true"></canvas><div class="world-fade" aria-hidden="true"></div><p class="world-loading" role="status">The storyteller clears their throat…</p>`;
  const view = stage.querySelector(".world-view");
  const overlay = stage.querySelector(".world-overlay");
  const weatherLayer = stage.querySelector(".world-weather");
  const ctx = view.getContext("2d");
  const octx = overlay.getContext("2d");

  const w = {
    destroyed: false,
    ready: false,
    motion,
    snapshot: bridge.read(),
    planck: null,
    tale: null,
    art: null,
    angle: 0,
    path: [],
    dispatching: false,
    quality: 0,
    frameMs: [],
    fx: [],
    tickers: new Set(),
    glide: null,
    bob: 0,
    time: 0,
    aim: null,
    near: null,
  };
  let target = null,
    image = null,
    input = null,
    raf = 0,
    last = 0,
    observer = null;

  // ── Loading ────────────────────────────────────────────────────────────
  import("../vendor/planck.mjs")
    .then((planck) => {
      if (w.destroyed) return;
      w.planck = planck;
      // Let the loading line paint before the art is painted.
      requestAnimationFrame(() => {
        try {
          start();
        } catch (error) {
          onError(error);
        }
      });
    })
    .catch((error) => !w.destroyed && onError(error));

  function start() {
    if (w.destroyed) return;
    w.tale = w.snapshot?.tale ?? "wisdom";
    const followers = (TALE_WORLD[w.tale]?.followers ?? []).map((f) => f.kind);
    w.art = worldArtFor(w.tale, Object.values(layoutsFor(w.tale)), followers);
    w.hand = handFor(w.tale, heroOf(w.tale));
    w.glints = { open: glintSprite([243, 220, 154]), remembered: glintSprite([159, 192, 200]), shut: glintSprite([140, 128, 110]) };
    w.eye = eyeOf(w.tale);
    input = createInput(root, view, {
      interact: () => interact(),
      lift: () => lift(),
      toss: () => toss(),
      cancel: () => cancelRoute(),
      paused,
      tap: (u, v) => tapAt(u, v),
      capture: !new URLSearchParams(location.search).has("worldtest"),
    });
    observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    w.ready = true;
    setSnapshot(w.snapshot);
    stage.querySelector(".world-loading")?.remove();
    stage.dataset.ready = "true";
    events.onReady?.();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const cw = stage.clientWidth || 800,
      ch = stage.clientHeight || 600;
    const H = Math.min(QUALITY[w.quality], Math.max(160, Math.round(ch)));
    const W = Math.max(160, Math.min(760, Math.round((H * cw) / ch)));
    if (target && target.w === W && target.h === H) return sizeOverlay();
    target = createTarget(W, H);
    view.width = W;
    view.height = H;
    image = new ImageData(new Uint8ClampedArray(target.data.buffer), W, H);
    sizeOverlay();
  }
  function sizeOverlay() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = stage.clientWidth || 800,
      ch = stage.clientHeight || 600;
    if (overlay.width !== Math.round(cw * dpr) || overlay.height !== Math.round(ch * dpr)) {
      overlay.width = Math.round(cw * dpr);
      overlay.height = Math.round(ch * dpr);
    }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── The scene ──────────────────────────────────────────────────────────
  function setSnapshot(snapshot) {
    if (!w.ready) return;
    const previous = w.current;
    w.current = snapshot;
    w.dispatching = false;
    const { layout, view: v } = snapshot;
    if (!layout) return;
    const newGround = !previous || previous.ground !== snapshot.ground || previous.tale !== snapshot.tale || previous.view.seed !== v.seed;
    if (newGround) buildGround(layout, previous?.view.scene);
    else if (previous.view.scene !== v.scene) cancelRoute();
    const storm = v.atmosphere.weather === "storm" ? 1.5 + (v.stats.danger ?? 0) * 0.18 : 0;
    w.phys.setWind((layout.wind?.[0] ?? 0) - storm, layout.wind?.[1] ?? 0);
    for (const prop of w.phys.props) if (prop.source.flag) prop.cracked = Boolean(v.flags[prop.source.flag]);
    // Some people are only there once the story has brought them; companions
    // who have joined walk with you instead of standing where you met them.
    const joined = new Set(followersOf(w.tale, v.flags).map((f) => f.kind));
    for (const person of w.people) person.present = (!person.source.when || v.flags[person.source.when]) && !joined.has(person.source.kind);
    syncFollowers(v);
    w.light = lightModel(v.atmosphere);
    w.lamps = sceneLights(w.level, layout, w.light);
    stage.dataset.scene = v.scene;
    events.onPlaces(places());
    w.promptSignature = null;
    refreshPrompt();
  }

  function buildGround(layout, from) {
    cancelRoute();
    w.layout = layout;
    w.level = buildLevel(layout);
    w.prepared = prepareLevel(w.level, w.art);
    const spawn = spawnFor(layout, from);
    w.phys = createPhysics(w.planck, layout, spawn);
    w.remainder = 0;
    w.angle = facingFrom(layout, spawn);
    w.statics = w.level.things.map((t) => ({ ...t, sprite: w.art.sprites.get(spriteKey(t.kind, t.tint)) })).filter((t) => t.sprite);
    w.people = layout.people.map((p) => ({
      source: p,
      id: p.id,
      kind: p.kind,
      sprite: w.art.sprites.get(spriteKey(p.kind, p.tint)),
      x: p.at[0] + 0.5,
      y: p.at[1] + 0.5,
      home: [...p.at],
      goal: null,
      walked: 0,
      next: 1 + Math.random() * 2,
      present: true,
      flip: false,
    }));
    w.followers = [];
    w.trail = [];
    if (w.motion) fade(false);
  }

  /** Companions trail the hero along the path he actually walked. */
  function syncFollowers(v) {
    const want = followersOf(w.tale, v.flags).map((f) => f.kind);
    w.followers = w.followers.filter((f) => want.includes(f.kind));
    const at = w.phys.player.getPosition();
    for (const kind of want)
      if (!w.followers.some((f) => f.kind === kind)) w.followers.push({ kind, sprite: w.art.sprites.get(kind), x: at.x, y: at.y, walked: 0, flip: false });
  }

  function places() {
    const { layout, view: v } = w.current;
    if (!layout) return [];
    const actionMap = new Map(v.actions.map((a) => [a.id, a]));
    return [
      ...layout.spots.map((sp) => ({ ...sp, actions: sp.actions.map((id) => actionMap.get(id)).filter(Boolean) })),
      ...Object.entries(layout.exits).map(([id, tiles]) => ({
        id,
        at: tiles[Math.floor(tiles.length / 2)],
        tiles,
        exit: true,
        name: null,
        actions: [actionMap.get(id)].filter(Boolean),
      })),
    ].filter((p) => p.actions.length);
  }

  /** Who or what stands at a place, for its height and for aiming. */
  function standing(place) {
    const [x, y] = place.at;
    const person = w.people.find((p) => p.present && p.home[0] === x && p.home[1] === y);
    if (person) return { h: person.sprite.h * 0.8, z: person.source.perch ?? 0 };
    const thing = w.statics.find((t) => t.cell[0] === x && t.cell[1] === y);
    if (thing) return { h: Math.max(0.6, thing.sprite.h * 0.8), z: thing.sprite.lift ?? 0 };
    return { h: 0.9, z: 0 };
  }

  /** What you are facing, close enough to act on: aimed first, then underfoot. */
  function nearby() {
    const pos = w.phys.player.getPosition();
    const cam = camera(pos.x, pos.y, w.angle, target.w / target.h);
    const list = places().filter((p) => !p.exit);
    const targets = list.map((place) => ({ place, x: place.at[0] + 0.5, y: place.at[1] + 0.5, w: 1, ...standing(place) }));
    const hit = aimAt(cam, targets, w.level.solid, { reach: REACH, width: target.w, height: target.h, eye: w.eye });
    w.aim = hit?.target.place.id ?? null;
    if (hit) return [hit.target.place];
    return list
      .map((place) => {
        const dx = place.at[0] + 0.5 - pos.x,
          dy = place.at[1] + 0.5 - pos.y;
        const distance = Math.hypot(dx, dy);
        const facing = distance > 0.01 ? (dx * cam.dirX + dy * cam.dirY) / distance : 1;
        return { ...place, distance, facing };
      })
      .filter((p) => p.distance < 0.6 || (p.distance < 1.3 && p.facing > 0.2))
      .sort((a, b) => a.distance - b.distance);
  }

  function refreshPrompt() {
    if (!w.phys) return;
    const place = nearby()[0] ?? null;
    w.near = place;
    const carrying = w.phys.carrying;
    const liftable = w.phys.liftable();
    const signature = JSON.stringify([place?.id, place?.actions.map((a) => [a.id, a.enabled, a.requires]), carrying?.id, liftable?.id]);
    if (signature === w.promptSignature) return;
    w.promptSignature = signature;
    events.onNear({ place, carrying: carrying?.kind ?? null, liftable: liftable?.kind ?? null });
  }

  // ── Acting ─────────────────────────────────────────────────────────────
  /**
   * Act on what you face. A place with several things to do (a person to
   * talk to) opens a conversation in the story band instead.
   */
  function interact(id) {
    if (w.trialPress && !id) {
      w.trialPress();
      return true;
    }
    if (w.dispatching || paused() || busy()) return false;
    if (!id && events.onAdvance?.()) return true;
    const place = id ? places().find((p) => p.actions.some((a) => a.id === id)) : nearby()[0];
    if (!place) return false;
    const enabled = place.actions.filter((a) => a.enabled);
    if (!id && enabled.length > 1) {
      events.onConverse(place);
      return true;
    }
    const a = id ? place.actions.find((x) => x.id === id && x.enabled) : enabled[0];
    if (!a) return false;
    w.dispatching = true;
    cancelRoute();
    perform(a, place).then(() => {
      if (!w.destroyed) bridge.request(a, place);
    });
    return true;
  }

  /** Turn to the place and act it out: kneel to look, reach to take, nod to talk. */
  function perform(action, place) {
    if (place && !place.exit) {
      const p = w.phys.player.getPosition();
      w.faceTo = Math.atan2(place.at[1] + 0.5 - p.y, place.at[0] + 0.5 - p.x);
      if (!w.motion) w.angle = w.faceTo;
    }
    const gesture = GESTURE[action.type];
    if (!gesture || !w.motion) return Promise.resolve();
    addFx(gesture, gesture === "kneel" ? 520 : gesture === "reach" ? 380 : 300);
    return new Promise((resolve) => setTimeout(resolve, gesture === "kneel" ? 480 : 340));
  }

  function lift() {
    if (paused() || busy()) return;
    cancelRoute();
    if (w.phys.carrying) w.phys.throw(facing(), 0);
    else w.phys.lift();
    refreshPrompt();
  }
  function toss() {
    if (paused() || busy()) return;
    w.phys.throw(facing());
    refreshPrompt();
  }
  const facing = () => ({ x: Math.cos(w.angle), y: Math.sin(w.angle) });

  /** A tap on the view: walk to whatever was tapped. Returns true if it was something. */
  function tapAt(u, v) {
    if (!w.phys || paused() || busy()) return false;
    const sx = u * target.w,
      sy = v * target.h;
    const pos = w.phys.player.getPosition();
    const cam = camera(pos.x, pos.y, w.angle, target.w / target.h);
    let best = null;
    for (const place of places()) {
      const s = standing(place);
      const foot = projectPoint(cam, place.at[0] + 0.5, place.at[1] + 0.5, s.z, target.w, target.h, { eye: w.eye });
      if (!foot) continue;
      const half = Math.max(0.5 * foot.scale, target.w * 0.05);
      const top = foot.y - (s.h + 0.4) * foot.scale;
      if (sx >= foot.x - half && sx <= foot.x + half && sy >= top && sy <= foot.y + target.h * 0.04 && (!best || foot.depth < best.depth))
        best = { place, depth: foot.depth };
    }
    if (!best) return false;
    walkTo(best.place.id, true);
    return true;
  }

  // ── Walking a route ────────────────────────────────────────────────────
  function obstacles() {
    const blocked = blockedTiles(w.layout);
    for (const p of w.phys.props) {
      if (p.carried || !p.body.isActive()) continue;
      const at = p.body.getPosition();
      blocked.add(`${Math.floor(at.x)},${Math.floor(at.y)}`);
    }
    const [x, y] = w.phys.tile();
    blocked.delete(`${x},${y}`);
    return blocked;
  }

  function navigate(goal, { targetId = null, attempt = false, resolve = null, nearest = false } = {}) {
    cancelRoute();
    w.routeGoal = goal;
    const blocked = obstacles();
    let path = findPath(w.layout, w.phys.tile(), goal, blocked);
    if (!path && nearest)
      for (let radius = 1; radius <= 8 && !path; radius++)
        for (let dy = -radius; dy <= radius && !path; dy++)
          for (let dx = -radius; dx <= radius && !path; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            path = findPath(w.layout, w.phys.tile(), [goal[0] + dx, goal[1] + dy], blocked);
            if (path) w.routeGoal = [goal[0] + dx, goal[1] + dy];
          }
    if (!path) {
      events.onMessage("Something is in the way. Move it, or go round.");
      resolve?.(false);
      return false;
    }
    w.path = path.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
    w.routeRun = path.length > 6;
    w.routeRetries = w.routeTarget === targetId && w.routeGoal ? (w.routeRetries ?? 0) : 0;
    w.routeTarget = targetId;
    w.routeAttempt = attempt;
    w.routeResolve = resolve;
    w.stuckTime = 0;
    w.lastDistance = Infinity;
    return true;
  }

  function walkTo(id, attempt = false) {
    if (!w.phys) return Promise.resolve(false);
    const place = places().find((p) => p.id === id || p.actions.some((a) => a.id === id));
    if (!place || paused()) return Promise.resolve(false);
    return new Promise((resolve) => navigate(place.at, { targetId: id, attempt, resolve }));
  }

  function cancelRoute() {
    w.path = [];
    w.routeTarget = null;
    w.routeResolve?.(false);
    w.routeResolve = null;
    w.phys?.setIntent(0, 0);
  }

  function finishRoute() {
    const targetId = w.routeTarget,
      attempt = w.routeAttempt,
      resolve = w.routeResolve;
    w.routeResolve = null;
    w.path = [];
    w.routeTarget = null;
    const place = places().find((p) => p.id === targetId || p.actions.some((a) => a.id === targetId));
    // Arrive looking at what you came for.
    if (place && !place.exit) {
      const p = w.phys.player.getPosition();
      if (Math.hypot(place.at[0] + 0.5 - p.x, place.at[1] + 0.5 - p.y) > 0.05) {
        w.faceTo = Math.atan2(place.at[1] + 0.5 - p.y, place.at[0] + 0.5 - p.x);
        if (!w.motion) w.angle = w.faceTo;
      }
    }
    if (!attempt) return resolve?.(true);
    if (place?.exit) return resolve?.(true); // the exit fires on its own when you step on it
    const direct = place?.actions.find((a) => a.id === targetId && a.enabled);
    resolve?.(direct ? interact(direct.id) : place ? interactAt(place) : interact());
  }
  /** At a place after walking there: act on it, or open its conversation. */
  function interactAt(place) {
    const enabled = place.actions.filter((a) => a.enabled);
    if (enabled.length > 1) {
      events.onConverse(place);
      return true;
    }
    return enabled.length ? interact(enabled[0].id) : false;
  }

  // ── Camera effects ─────────────────────────────────────────────────────
  function addFx(kind, ms, amount = 1) {
    if (!w.motion && kind === "shake") return;
    w.fx.push({ kind, start: w.time, dur: ms / 1000, amount });
  }
  function fxOffsets() {
    const out = { eye: 0, horizon: 0, side: 0, forward: 0, hands: 0 };
    w.fx = w.fx.filter((f) => w.time - f.start < f.dur);
    for (const f of w.fx) {
      const t = (w.time - f.start) / f.dur;
      const arc = Math.sin(t * Math.PI);
      if (f.kind === "kneel") {
        out.eye -= 0.42 * arc;
        out.horizon += 10 * arc;
        out.hands += 0.25 * arc;
      } else if (f.kind === "reach") {
        out.forward += 0.18 * arc;
        out.hands += 0.45 * arc;
      } else if (f.kind === "talk") out.horizon += 4 * Math.sin(t * Math.PI * 2);
      else if (f.kind === "hop") out.eye += 0.32 * arc * f.amount;
      else if (f.kind === "dip") {
        out.eye -= 0.3 * arc * f.amount;
        out.hands -= 0.1 * arc;
      } else if (f.kind === "shake") {
        const k = (1 - t) * f.amount;
        out.side += Math.sin(w.time * 63) * 0.05 * k;
        out.horizon += Math.cos(w.time * 71) * 6 * k;
      }
    }
    return out;
  }
  function fade(out) {
    const el = stage.querySelector(".world-fade");
    el.classList.toggle("dark", out);
  }

  // ── One frame ──────────────────────────────────────────────────────────
  function frame(now) {
    if (w.destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!w.phys || !target) return;
    w.time += dt;
    update(dt);
    const t0 = performance.now();
    draw();
    govern(performance.now() - t0);
    for (const tick of [...w.tickers]) tick(dt);
    events.onFrame?.();
  }

  function update(dt) {
    const intent = input.read();
    const halted = paused() || busy();
    const p = w.phys.player.getPosition();
    let moveX = 0,
      moveY = 0,
      run = intent.run;
    if (!halted) {
      const manual = intent.forward || intent.strafe;
      if (manual || intent.turn || Math.abs(intent.look) > 0.02) {
        if (w.path.length) cancelRoute();
        w.faceTo = null;
      }
      w.angle += intent.turn * TURN_SPEED * dt + intent.look;
      const fx = Math.cos(w.angle),
        fy = Math.sin(w.angle);
      moveX = fx * intent.forward - fy * intent.strafe;
      moveY = fy * intent.forward + fx * intent.strafe;
      if (w.path.length) {
        const step = routeIntent(p, w.path[0]);
        if (step.arrived) {
          w.path.shift();
          w.lastDistance = Infinity;
          w.stuckTime = 0;
          if (!w.path.length) finishRoute();
        } else {
          moveX = step.x;
          moveY = step.y;
          // Look where you walk, turning no faster than a person turns.
          w.angle = w.motion ? turnToward(w.angle, Math.atan2(step.y, step.x), 7 * dt) : Math.atan2(step.y, step.x);
          w.stuckTime = step.distance >= w.lastDistance - 0.005 ? w.stuckTime + dt * 1000 : 0;
          w.lastDistance = step.distance;
          if (w.stuckTime > 700) unstick();
        }
        run = run || w.routeRun;
      } else if (w.faceTo != null) {
        w.angle = turnToward(w.angle, w.faceTo, 6 * dt);
        if (Math.abs(Math.atan2(Math.sin(w.faceTo - w.angle), Math.cos(w.faceTo - w.angle))) < 0.01) w.faceTo = null;
      }
      if (moveX || moveY) events.onMove?.();
    }
    if (w.glide) {
      moveX = 0;
      moveY = 0;
    }
    w.phys.setIntent(moveX, moveY, run);
    if (!halted || w.trialPress) w.remainder = w.phys.advance(dt, w.remainder);
    const v = w.phys.player.getLinearVelocity();
    const speed = Math.hypot(v.x, v.y);
    w.bob += speed * dt * 2.1;
    w.moving = speed > 0.25;
    updatePeople(dt);
    followTrail(dt);
    const happened = w.phys.events.splice(0);
    for (const e of happened) {
      if (e.type === "crack") {
        events.onMessage(`The ${e.prop.kind} cracks.`);
        addFx("shake", 160, 0.8);
        if (e.prop.source.flag) queueMicrotask(() => !w.destroyed && bridge.crack(e.prop));
      }
      if (e.type === "knock" || e.type === "land") events.onImpact?.(e.impulse);
    }
    refreshPrompt();
    if (!halted && !w.dispatching) checkExits();
  }

  function unstick() {
    const targetId = w.routeTarget,
      attempt = w.routeAttempt,
      resolve = w.routeResolve;
    const retries = (w.routeRetries ?? 0) + 1;
    w.routeResolve = null;
    if (retries > 3) {
      cancelRoute();
      events.onMessage("Something is in the way. Move it, or go round.");
      resolve?.(false);
    } else {
      navigate(w.routeGoal, { targetId, attempt, resolve });
      w.routeRetries = retries;
    }
  }

  /** Walking off the edge of the map takes the road that leaves there. */
  function checkExits() {
    const tile = w.phys.tile();
    const exit = places().find(
      (pl) => pl.exit && (!w.routeTarget || pl.id === w.routeTarget || pl.actions.some((a) => a.id === w.routeTarget)) && pl.tiles.some(([ex, ey]) => tile[0] === ex && tile[1] === ey),
    );
    if (!exit) {
      w.blockedExit = null;
      return;
    }
    const action = exit.actions[0];
    if (action.enabled) {
      const resolve = w.routeResolve;
      w.routeResolve = null;
      w.dispatching = true;
      cancelRoute();
      if (w.motion) fade(true);
      setTimeout(
        () => {
          if (w.destroyed) return;
          bridge.request(action, exit);
          resolve?.(true);
        },
        w.motion ? 280 : 0,
      );
    } else if (w.blockedExit !== exit.id) {
      w.blockedExit = exit.id;
      events.onMessage(action.requires ?? "That way is closed for now.");
    }
  }

  /** People stand and breathe, or wander their few steps; animals peck about. */
  function updatePeople(dt) {
    if (!w.motion) return;
    for (const person of w.people) {
      const r = person.source.wander;
      if (!r || !person.present) continue;
      if (!person.goal) {
        person.next -= dt;
        if (person.next > 0) continue;
        person.next = 1.6 + Math.random() * 2.4;
        const [hx, hy] = person.home;
        for (let i = 0; i < 6; i++) {
          const tx = hx + Math.round((Math.random() * 2 - 1) * r),
            ty = hy + Math.round((Math.random() * 2 - 1) * r);
          if (walkable(w.layout, tx, ty)) {
            person.goal = { x: tx + 0.5, y: ty + 0.5 };
            break;
          }
        }
        continue;
      }
      const dx = person.goal.x - person.x,
        dy = person.goal.y - person.y;
      const d = Math.hypot(dx, dy);
      const step = Math.min(d, (person.sprite.animal ? 1.1 : 0.8) * dt);
      if (d < 0.02) {
        person.goal = null;
        continue;
      }
      person.x += (dx / d) * step;
      person.y += (dy / d) * step;
      person.walked += step;
      person.heading = { x: dx / d, y: dy / d };
    }
  }

  function followTrail(dt) {
    if (!w.followers.length) return;
    const head = w.phys.player.getPosition();
    const lastPoint = w.trail[0];
    if (!lastPoint || Math.hypot(head.x - lastPoint.x, head.y - lastPoint.y) > 0.1) w.trail.unshift({ x: head.x, y: head.y });
    w.trail.length = Math.min(w.trail.length, 240);
    const back = { x: -Math.cos(w.angle), y: -Math.sin(w.angle) };
    w.followers.forEach((f, i) => {
      let goal = w.trail[Math.min(w.trail.length - 1, (i + 1) * 9)] ?? head;
      if (Math.hypot(goal.x - head.x, goal.y - head.y) < 0.75 * (i + 1))
        goal = { x: head.x + back.x * 0.85 * (i + 1) + (i % 2 ? 0.25 : -0.25), y: head.y + back.y * 0.85 * (i + 1) };
      const dx = goal.x - f.x,
        dy = goal.y - f.y;
      const k = Math.min(1, dt * 10);
      f.x += dx * k;
      f.y += dy * k;
      f.walked += Math.hypot(dx, dy) * k;
      if (Math.hypot(dx, dy) > 0.01) f.heading = { x: dx, y: dy };
    });
  }

  // ── Drawing ────────────────────────────────────────────────────────────
  function eyeCamera() {
    const fx = fxOffsets();
    const p = w.glide ? glidePosition() : w.phys.player.getPosition();
    const dirX = Math.cos(w.angle),
      dirY = Math.sin(w.angle);
    const bobbing = w.motion && w.moving ? Math.sin(w.bob * 2) : 0;
    const cam = camera(p.x + dirX * fx.forward - dirY * fx.side, p.y + dirY * fx.forward + dirX * fx.side, w.angle, target.w / target.h);
    const k = target.h / 270;
    return { cam, eye: w.eye + fx.eye + bobbing * 0.025, horizon: (fx.horizon + bobbing * 1.4) * k, fx };
  }

  function glidePosition() {
    const g = w.glide;
    const t = Math.min(1, (w.time - g.start) / g.dur);
    const e = t * t * (3 - 2 * t);
    return { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
  }

  function things(cam) {
    const v = w.current.view;
    const taken = new Set(v.taken);
    const list = [];
    for (const t of w.statics) if (!taken.has(t.item)) list.push({ sprite: t.sprite, x: t.x, y: t.y, z: t.sprite.lift ?? 0, frame: 0 });
    const right = { x: -cam.dirY, y: cam.dirX };
    const facingFrame = (who) => (who.sprite.frames ? (w.motion ? Math.floor(who.walked * 5) % 4 : 0) : 0);
    for (const person of w.people) {
      if (!person.present || !person.sprite) continue;
      const flip = person.sprite.side && person.heading ? person.heading.x * right.x + person.heading.y * right.y < 0 : false;
      const breath = !person.goal && person.sprite.frames && w.motion && Math.sin(w.time * 1.3 + person.home[0] * 3 + person.home[1]) > 0.985 ? 1 : null;
      list.push({ sprite: person.sprite, x: person.x, y: person.y, z: person.source.perch ?? person.sprite.lift ?? 0, frame: breath ?? (person.goal ? facingFrame(person) : 0), flip, highlight: w.aim === person.id });
    }
    for (const f of w.followers) {
      if (!f.sprite) continue;
      const flip = f.heading ? f.heading.x * right.x + f.heading.y * right.y < 0 : false;
      list.push({ sprite: f.sprite, x: f.x, y: f.y, z: 0, frame: facingFrame(f), flip });
    }
    for (const prop of w.phys.props) {
      if (prop.carried || taken.has(prop.source.item ?? prop.kind)) continue;
      const sprite = w.art.sprites.get(spriteKey(prop.kind, prop.source.tint));
      if (!sprite) continue;
      const at = prop.body.getPosition();
      list.push({ sprite, x: at.x, y: at.y, z: prop.z * 0.6, frame: 0, glow: prop.cracked ? 0 : 0, highlight: w.phys.liftable() === prop });
    }
    // A glint over everything you can look at, take or talk to.
    for (const place of places()) {
      if (place.exit) continue;
      const enabled = place.actions.some((a) => a.enabled);
      const remembered = place.actions.some((a) => a.remembered);
      const s = standing(place);
      const bob = w.motion ? Math.sin(w.time * 3 + place.at[0]) * 0.06 : 0;
      const glint = remembered ? w.glints.remembered : enabled ? w.glints.open : w.glints.shut;
      list.push({ sprite: glint, x: place.at[0] + 0.5, y: place.at[1] + 0.5, z: s.z + s.h + 0.35 + bob, frame: 0, shadow: false });
    }
    return list;
  }

  function draw() {
    const { cam, eye, horizon, fx } = eyeCamera();
    w.lastCam = { cam, eye, horizon };
    const stats = renderFrame(target, w.prepared, cam, { light: w.light, time: w.time, eye, horizon, things: things(cam), lights: w.lamps });
    drawHands(fx);
    vignette(target, w.light.day < 0.3 ? 0.55 : 0.3);
    ctx.putImageData(image, 0, 0);
    w.stats = stats;
  }

  /** The hero's hands at the bottom of the frame, swaying as they walk. */
  function drawHands(fx) {
    const H = target.h,
      W = target.w;
    const size = H * 0.46;
    const sway = w.motion && w.moving ? Math.sin(w.bob) * size * 0.05 : 0;
    const lift = w.motion && w.moving ? Math.abs(Math.cos(w.bob)) * size * 0.05 : 0;
    const raise = fx.hands * size;
    const k = Math.min(1.15, 0.3 + w.light.day * 0.75 + w.light.torch * 0.45);
    const mul = [k * w.light.tint[0] * 0.95 + 0.05, k * w.light.tint[1] * 0.95 + 0.05, k * w.light.tint[2] * 0.95 + 0.05];
    const carrying = w.phys.carrying;
    const inward = carrying ? size * 0.32 : 0;
    const y = H - size * 0.82 + lift - raise - (carrying ? size * 0.3 : 0);
    if (carrying) {
      const sprite = w.art.sprites.get(spriteKey(carrying.kind, carrying.source.tint));
      if (sprite) blit(target, sprite.tex, W / 2 - size * 0.55 + sway, y - size * 0.35, size * 1.1, size * 1.1, { mul });
    }
    blit(target, w.hand, W / 2 + size * 0.15 - inward + sway, y, size, size, { mul });
    blit(target, w.hand, W / 2 - size * 1.15 + inward + sway, y, size, size, { mul, flip: true });
  }

  /** Drop to a smaller frame when drawing is slow, and climb back when it is quick. */
  function govern(ms) {
    w.frameMs.push(ms);
    if (w.frameMs.length < 40) return;
    const avg = w.frameMs.reduce((a, b) => a + b, 0) / w.frameMs.length;
    w.frameMs = [];
    w.avgMs = avg;
    if (avg > 12 && w.quality < QUALITY.length - 1) {
      w.quality++;
      resize();
    } else if (avg < 4 && w.quality > 0) {
      w.quality--;
      resize();
    }
  }

  // ── Screen positions for the shell ─────────────────────────────────────
  /** CSS pixels inside the stage of a point `z` metres above a tile centre, or null if behind you. */
  function project([x, y], z = 0) {
    if (!w.lastCam || !target) return null;
    const { cam, eye, horizon } = w.lastCam;
    const p = projectPoint(cam, x + 0.5, y + 0.5, z, target.w, target.h, { eye, horizon: target.h / 2 + horizon });
    if (!p) return null;
    const sx = stage.clientWidth / target.w,
      sy = stage.clientHeight / target.h;
    return { x: p.x * sx, y: p.y * sy, depth: p.depth };
  }

  function flyToBag(itemId, screenTarget) {
    const thing = w.statics.find((t) => t.item === itemId) ?? w.phys.props.find((p) => (p.source.item ?? p.kind) === itemId);
    const at = thing ? (thing.body ? thing.body.getPosition() : { x: thing.x, y: thing.y }) : null;
    const from = (at && project([at.x - 0.5, at.y - 0.5], 0.4)) ?? { x: stage.clientWidth / 2, y: stage.clientHeight * 0.7 };
    if (!w.motion) return;
    const token = document.createElement("i");
    token.className = "bag-token";
    token.style.transform = `translate(${from.x}px, ${from.y}px)`;
    stage.append(token);
    token
      .animate([{ transform: `translate(${from.x}px, ${from.y}px) scale(1)` }, { transform: `translate(${screenTarget.x}px, ${screenTarget.y}px) scale(0.6)` }], {
        duration: 650,
        easing: "cubic-bezier(.5,0,.9,.5)",
      })
      .finished.then(() => token.remove(), () => token.remove());
  }

  // ── Trials ─────────────────────────────────────────────────────────────
  /** What a trial may use: the overlay, the camera, the hero, the clock. */
  const trialStage = {
    get overlay() {
      return { ctx: octx, width: stage.clientWidth, height: stage.clientHeight };
    },
    get motion() {
      return w.motion;
    },
    get planck() {
      return w.planck;
    },
    get layout() {
      return w.layout;
    },
    player: () => {
      const p = w.glide ? glidePosition() : w.phys.player.getPosition();
      return { x: p.x, y: p.y };
    },
    facing,
    face(x, y) {
      const p = trialStage.player();
      w.faceTo = Math.atan2(y - p.y, x - p.x);
      if (!w.motion) w.angle = w.faceTo;
    },
    project: (x, y, z = 0) => project([x - 0.5, y - 0.5], z),
    fx: (kind, ms = 300, amount = 1) => addFx(kind, ms, amount),
    shove(x, y) {
      const m = w.phys.player.getMass();
      w.phys.player.applyLinearImpulse({ x: x * m, y: y * m }, w.phys.player.getPosition(), true);
    },
    glideTo(x, y, ms = 280) {
      const from = trialStage.player();
      w.glide = { from, to: { x, y }, start: w.time, dur: w.motion ? ms / 1000 : 0.001 };
    },
    endGlide() {
      w.glide = null;
    },
    onTick: (fn) => w.tickers.add(fn),
    offTick: (fn) => w.tickers.delete(fn),
    clear: () => octx.clearRect(0, 0, stage.clientWidth, stage.clientHeight),
    setPress: (fn) => (w.trialPress = fn),
    setInfo: (fn) => (w.trialInfo = fn),
    props: () => w.layout.props,
  };

  return {
    root: stage,
    sync(nextMotion) {
      w.snapshot = bridge.read();
      w.motion = nextMotion;
      const atmosphere = w.snapshot?.view.atmosphere ?? { weather: "none", light: "day" };
      stage.dataset.weather = atmosphere.weather;
      stage.dataset.light = atmosphere.light;
      // Mist and dust are fog in the renderer; drawing them again on top washes the view out.
      mountWeather(weatherLayer, FOGGED.has(atmosphere.weather) ? "none" : atmosphere.weather, nextMotion);
      if (w.ready) setSnapshot(w.snapshot);
    },
    get ready() {
      return w.ready;
    },
    walkTo,
    interact: (id) => (w.ready ? interact(id) : false),
    lift: () => w.ready && lift(),
    toss: () => w.ready && toss(),
    release() {
      w.dispatching = false;
    },
    project,
    heroScreen: () => ({ x: stage.clientWidth / 2, y: stage.clientHeight * 0.4 }),
    flyToBag,
    /** The map, the hero and what to mark, for the minimap. */
    mapState() {
      if (!w.ready || !w.layout) return null;
      const p = w.phys.player.getPosition();
      return { layout: w.layout, level: w.level, x: p.x, y: p.y, angle: w.angle, places: places(), followers: w.followers.map((f) => ({ x: f.x, y: f.y })) };
    },
    portrait(kind) {
      const sprite = w.art?.sprites.get(kind);
      return sprite ? portraitOf(sprite) : null;
    },
    inspect() {
      if (!w.ready) return null;
      const p = w.phys.player.getPosition();
      return {
        scene: w.current.view.scene,
        position: { x: p.x, y: p.y },
        angle: w.angle,
        walking: w.path.length > 0,
        aim: w.aim,
        near: w.near?.id ?? null,
        frame: { width: target.w, height: target.h, ms: w.avgMs ?? null, things: w.stats?.things ?? 0, walls: w.stats?.wallColumns ?? 0 },
        art: { walls: w.art.walls.size, floors: w.art.floors.size, sprites: w.art.sprites.size, hero: heroOf(w.tale), hands: Boolean(w.hand) },
        places: places().map((pl) => pl.id),
        trial: w.trialInfo?.() ?? null,
        props: w.phys.props.map((prop) => ({ id: prop.id, x: prop.body.getPosition().x, y: prop.body.getPosition().y, cracked: prop.cracked, carried: prop.carried })),
      };
    },
    placed: (id) => (w.ready ? places().some((p) => p.id === id || p.actions.some((a) => a.id === id)) : false),
    /** Turn (not move) to face a point: the test driver aims this way. */
    face(x, y) {
      if (!w.ready) return;
      const p = w.phys.player.getPosition();
      w.faceTo = Math.atan2(y - p.y, x - p.x);
      if (!w.motion) w.angle = w.faceTo;
    },
    /** Where a place shows on screen (CSS pixels in the stage), or null if out of view. */
    screenOf(id) {
      const place = w.ready && places().find((p) => p.id === id || p.actions.some((a) => a.id === id));
      if (!place) return null;
      const s = standing(place);
      return project(place.at, s.z + s.h / 2);
    },
    trial(kind, profile, ui, seed) {
      if (!w.ready) return Promise.resolve(null);
      cancelRoute();
      return playTrial(trialStage, kind, profile, ui, seed);
    },
    destroy() {
      w.destroyed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      input?.destroy();
      cancelRoute();
      stage.remove();
    },
  };
}
