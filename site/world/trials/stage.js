// Trials, staged in the world. The rules come from core.js (tested and
// calibrated in Node); this file only draws them and listens for the press.
//
// leap    the stepping stones of the ford: hop as each stone rises
// brace   the squall: dig in as each gust shadow reaches you
// balance the climb: a side view of the trunk, the pot swinging on its rope
// scale   the elders' circle: argument stones dropped on a real beam balance
import { createTiming, paramsFor } from "./core.js";
import { TILE } from "../art.js";

const TEXT = {
  leap: {
    intro: "The stones rock in the current. Each one rises for a moment.",
    hint: "Press E or Space as the ring closes on a stone.",
    good: ["The stone holds.", "Firm footing.", "Across."],
    bad: ["The stone tips and the river takes your ankle.", "Too soon. Cold water to the knee.", "Too late. You splash down."],
  },
  brace: {
    intro: "The gusts come in rows across the grass. You can see each one coming.",
    hint: "Press E or Space as a gust shadow reaches you.",
    good: ["You dig in. It passes.", "Steady.", "The wind slides off your shoulders."],
    bad: ["It shoves you sideways.", "You stagger.", "The pot lurches against you."],
  },
  balance: {
    intro: "The trunk sways. The pot swings on its rope with every sway.",
    hint: "Press E or Space as the pot reaches the top of its swing.",
    good: ["Your weight goes with it.", "Steady hands.", "The pot settles."],
    bad: ["The rope bites. You slip a hand-width.", "The pot drags you sideways.", "Bark scrapes your knee."],
  },
};

/**
 * Run one trial. Resolves to { mode: "skill", pass, score } or null if the
 * player steps back.
 * @param scene the ExploreScene
 * @param kind  skill kind
 * @param profile from bridge.profile(): odds, clues, deductions, flags
 * @param ui { say(text, tone), hint(text), feedback(text, good), done(), onCancel(fn), choices(list) }
 */
export function playTrial(scene, kind, profile, ui, seed) {
  if (kind === "scale") return scaleTrial(scene, profile, ui);
  const params = paramsFor(kind, profile);
  const trial = createTiming(params, seed);
  const text = TEXT[kind] ?? TEXT.leap;
  const view = kind === "leap" ? leapView(scene, trial) : kind === "brace" ? braceView(scene, trial) : balanceView(scene, trial, profile, ui);
  ui.say(`${text.intro} ${params.need === params.moments ? "Every one" : `${params.need} of ${params.moments}`} must go well.`, "trial");
  ui.hint(text.hint);
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      scene.events.off("update", tick);
      scene.trialPress = null;
      scene.trialInfo = null;
      view.destroy();
      ui.done();
      resolve(result);
    };
    ui.onCancel(() => finish(null));
    scene.trialPress = () => {
      const r = trial.press();
      if (!r) return;
      const line = (r.good ? text.good : text.bad)[r.index % 3];
      ui.feedback(line, r.good);
      view.answer(r.index, r.good, r.error);
    };
    let ending = 0;
    // What the test driver may read: the next instant, never the answer.
    scene.trialInfo = () => ({ kind, next: trial.current() >= 0 ? trial.times[trial.current()] - trial.clock : null, done: trial.done, good: trial.good });
    const tick = (_t, deltaMs) => {
      const before = trial.answers.map((a) => a?.missed);
      trial.advance(Math.min(0.05, deltaMs / 1000));
      trial.answers.forEach((a, i) => {
        if (a?.missed && !before[i]) {
          ui.feedback(text.bad[i % 3], false);
          view.answer(i, false, null);
        }
      });
      view.draw(trial);
      if (trial.done) {
        ending += deltaMs;
        if (ending > 900) finish({ mode: "skill", pass: trial.pass, score: trial.score });
      }
    };
    scene.events.on("update", tick);
  });
}

// ── Leap: the stepping stones ─────────────────────────────────────────────
function leapView(scene, trial) {
  const layout = scene.snapshot.layout;
  // Stones are the props of kind "stone"; ordered from the near bank.
  const stones = layout.props.filter((p) => p.kind === "stone").sort((a, b) => a.at[1] - b.at[1]);
  const spots = stones.length >= trial.times.length ? stones : Array.from({ length: trial.times.length }, (_, i) => ({ at: [scene.phys.tile()[0], scene.phys.tile()[1] + 2 + i * 2] }));
  const at = (i) => ({ x: (spots[i].at[0] + 0.5) * TILE, y: (spots[i].at[1] + 0.5) * TILE });
  const g = scene.add.graphics().setDepth(99990);
  const splash = scene.add.graphics().setDepth(99991);
  const hero = scene.hero.root;
  const start = { x: hero.x, y: hero.y };
  scene.heroLocked = true;
  hero.setDepth(99992);
  // Frame the stones above the story band.
  const cam = scene.cameras.main;
  cam.stopFollow();
  cam.pan(at(1).x, at(1).y + scene.scale.height * 0.18 / cam.zoom, scene.motion ? 600 : 0, "Sine.easeInOut");
  return {
    draw(t) {
      g.clear();
      const i = t.current();
      spots.forEach((_, k) => {
        const p = at(k);
        const rise = k === i ? t.nearness() : 0;
        g.fillStyle(0xd8e7df, 0.18 + rise * 0.3).fillEllipse(p.x, p.y + 6, 44, 14);
        if (k === i) {
          // The closing ring: it meets the stone at the instant.
          const r = 20 + Math.max(0, t.times[i] - t.clock) * 55;
          g.lineStyle(3, 0xf3dc9a, 0.9).strokeCircle(p.x, p.y - rise * 6, Math.min(r, 110));
          g.lineStyle(2, 0xf3dc9a, 0.35).strokeCircle(p.x, p.y - rise * 6, 20);
        }
      });
    },
    answer(i, good) {
      const p = at(i);
      scene.tweens.add({
        targets: hero,
        x: p.x,
        y: p.y - 6,
        duration: 260,
        ease: "Quad.out",
        onUpdate: (tw) => hero.setScale(hero.scaleX, 1 + Math.sin(tw.progress * Math.PI) * 0.15),
        onComplete: () => {
          hero.setScale(hero.scaleX, 1);
          if (!good) {
            splash.fillStyle(0xd8eef0, 0.9);
            for (let k = 0; k < 9; k++) splash.fillCircle(p.x + Math.cos(k) * 18, p.y + Math.sin(k * 1.7) * 8, 4);
            scene.tweens.add({ targets: splash, alpha: 0, duration: 600, onComplete: () => splash.clear().setAlpha(1) });
            if (scene.motion) scene.cameras.main.shake(120, 0.004);
          }
        },
      });
    },
    destroy() {
      g.destroy();
      splash.destroy();
      // Across: the story moves you to the far bank.
      scene.heroLocked = false;
      hero.setPosition(start.x, start.y);
      scene.cameras.main.startFollow(hero, true, 0.1, 0.1);
    },
  };
}

// ── Brace: gusts across the grass ─────────────────────────────────────────
function braceView(scene, trial) {
  const g = scene.add.graphics().setDepth(99990).setScrollFactor(0);
  const hero = scene.hero.root;
  const cam = scene.cameras.main;
  return {
    draw(t) {
      g.clear();
      const heroX = (hero.x - cam.worldView.x) * cam.zoom;
      const w = scene.scale.width,
        h = scene.scale.height;
      t.times.forEach((time, i) => {
        if (t.answers[i]) return;
        // The gust shadow travels from the right edge to the hero in one period.
        const x = heroX + (time - t.clock) * (w / 2.2);
        if (x < -80 || x > w + 120) return;
        g.fillStyle(0x0f1a14, 0.28).fillRect(x - 30, 0, 60, h);
        g.fillStyle(0xdfe8dc, 0.18).fillRect(x - 34, 0, 4, h);
      });
      g.lineStyle(3, 0xf3dc9a, 0.8).lineBetween(heroX, (hero.y - cam.worldView.y) * cam.zoom - 70, heroX, (hero.y - cam.worldView.y) * cam.zoom + 10);
    },
    answer(_i, good) {
      if (good) scene.tweens.add({ targets: hero, scaleY: 0.82, duration: 140, yoyo: true, hold: 200 });
      else {
        const m = scene.phys.player.getMass();
        scene.phys.player.applyLinearImpulse({ x: -2.4 * m, y: 0.4 * m }, scene.phys.player.getPosition(), true);
        scene.phys.step();
        if (scene.motion) cam.shake(160, 0.006);
      }
    },
    destroy() {
      g.destroy();
    },
  };
}

// ── Balance: a side view of the climb, the pot swinging on its rope ───────
function balanceView(scene, trial, profile, ui) {
  const behind = profile.flags?.includes("behind") || profile.flags?.includes("knotTaught");
  const w = scene.scale.width;
  // Draw in the space above the story band.
  const h = scene.scale.height - (ui.bandHeight?.() ?? scene.scale.height * 0.32) - 20;
  const layer = scene.add.container(0, 0).setDepth(99995).setScrollFactor(0);
  const back = scene.add.graphics();
  back.fillStyle(0x182114, 0.94).fillRect(0, 0, w, scene.scale.height);
  const cx = w / 2;
  // Far trees, then the trunk with its bark, then leaves crowding the edges.
  for (let i = 0; i < 9; i++) back.fillStyle(0x223020, 1).fillCircle((i * 173) % w, h * 0.2 + ((i * 97) % 120), 90);
  back.fillStyle(0x7d6950).fillRect(cx - 50, 0, 100, scene.scale.height);
  back.lineStyle(3, 0x5a4a37, 0.7);
  for (let i = -2; i <= 2; i++) back.lineBetween(cx + i * 17, 0, cx + i * 18, scene.scale.height);
  const leaf = (x, y, r, seed) => {
    for (let k = 0; k < 9; k++) {
      const a = (k * 2.4 + seed) % (Math.PI * 2);
      back.fillStyle(k % 3 ? 0x3d5c35 : 0x4d6d3f, 1).fillCircle(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.45, r * (0.35 + (k % 4) * 0.08));
    }
  };
  leaf(cx + 190, h * 0.25, 90, 1);
  leaf(cx - 210, h * 0.55, 80, 2);
  leaf(cx + 230, h * 0.8, 70, 3);
  // The ledge above: where the climb ends.
  back.fillStyle(0x6c5a45).fillRoundedRect(cx - 10, 26, 210, 22, 10);
  back.fillStyle(0x4d6d3f).fillCircle(cx + 200, 30, 26);
  const fig = scene.add.graphics();
  const pot = scene.add.graphics();
  const ring = scene.add.graphics();
  layer.add([back, pot, fig, ring]);
  // A pendulum: the rope from Kweku's hand, the pot at the end.
  let theta = 0.3,
    omega = 0,
    climb = 0;
  const L = behind ? 38 : 68;
  const base = h * 0.78;
  const goal = h * 0.5;
  return {
    draw(t) {
      const dt = 1 / 60;
      const i = t.current();
      const pushT = i >= 0 ? t.times[i] - t.clock : 9;
      const force = pushT > 0 && pushT < 0.35 ? Math.sin(t.clock * 9) * 6 : 0;
      omega += (-(9.8 / (L / 40)) * Math.sin(theta) * 0.6 + force - omega * (behind ? 1.6 : 0.7)) * dt;
      theta += omega * dt;
      // He climbs steadily; each good answer is a hand-hold gained.
      climb = Math.min(goal, climb + dt * (goal / (t.times.at(-1) + 1)));
      const y = base - climb;
      const hand = { x: cx + (behind ? -16 : 24), y: y - 4 };
      fig.clear();
      fig.lineStyle(7, 0x3f2c20).lineBetween(cx - 4, y + 20, cx - 16, y + 46).lineBetween(cx + 12, y + 20, cx + 22, y + 44);
      fig.fillStyle(0xe0ba69).fillRoundedRect(cx - 10, y - 26, 28, 46, 7);
      fig.fillStyle(0x7a4e35).fillCircle(cx + 4, y - 40, 13);
      fig.fillStyle(0x221b14).fillEllipse(cx + 4, y - 50, 22, 10);
      fig.lineStyle(7, 0x7a4e35).lineBetween(cx - 6, y - 18, cx - 34, y - 42).lineBetween(cx + 14, y - 16, hand.x, hand.y);
      pot.clear();
      const px = hand.x + Math.sin(theta) * L,
        py = hand.y + Math.cos(theta) * L;
      pot.lineStyle(3, 0xc9b27a).lineBetween(hand.x, hand.y, px, py);
      pot.fillStyle(0x6e4430).fillEllipse(px, py + 16, 50, 46);
      pot.fillStyle(0xa86f4c).fillEllipse(px - 6, py + 12, 32, 30);
      pot.fillStyle(0xb8402c).fillCircle(px - 5, py - 4, 4);
      ring.clear();
      if (i >= 0) {
        const r = 24 + Math.max(0, t.times[i] - t.clock) * 60;
        ring.lineStyle(3, 0xf3dc9a, 0.9).strokeCircle(px, py + 16, Math.min(r, 120));
      }
    },
    answer(_i, good) {
      if (good) omega *= 0.3;
      else {
        omega += theta > 0 ? 2.2 : -2.2;
        climb = Math.max(0, climb - 24);
        if (scene.motion) scene.cameras.main.shake(120, 0.004);
      }
    },
    destroy() {
      layer.destroy(true);
    },
  };
}

// ── Scale: argument stones on the elders' balance ─────────────────────────
const EVIDENCE = [
  { id: "listen", label: "Hear him before you judge him", weight: 2, when: () => true },
  { id: "ask", label: "Let him say what he wants", weight: 2, when: () => true },
  { id: "selfSealed", label: "The second seal was his own promise", weight: 3, when: (p) => p.clues.includes("promiseSeal") || p.deductions.includes("selfSealed") },
  { id: "whyHide", label: "He hoped someone would follow him", weight: 2, when: (p) => p.deductions.includes("whyHide") },
  { id: "savedWhisper", label: "The gourd kept one voice safe", weight: 1, when: (p) => p.flags.includes("savedWhisper") },
  { id: "knotTaught", label: "He let another carry the weight", weight: 1, when: (p) => p.flags.includes("knotTaught") },
  { id: "gathered", label: "The neighbours came to listen", weight: 1, when: (p) => p.flags.includes("gathered") },
];

/** The weight the circle's doubt puts on the other pan, from the story's odds. */
export function scaleNeed(chance) {
  return Math.max(2, Math.min(7, Math.round(7 - chance * 5)));
}

function scaleTrial(scene, profile, ui) {
  const planck = scene.planck;
  const need = scaleNeed(profile.chance ?? 0.5);
  const stones = EVIDENCE.filter((e) => e.when({ clues: [], deductions: [], flags: [], ...profile }));
  const w = scene.scale.width,
    h = scene.scale.height;
  const layer = scene.add.container(0, 0).setDepth(99995).setScrollFactor(0);
  const back = scene.add.graphics();
  back.fillStyle(0x161b13, 0.86).fillRect(0, 0, w, h);
  const art = scene.add.graphics();
  layer.add([back, art]);
  // A real beam on a pivot, two pans on chains, stones dropped as bodies.
  const world = new planck.World({ gravity: { x: 0, y: 10 } });
  const S = 40; // px per metre for this vignette
  const usable = h - (ui.bandHeight?.() ?? h * 0.32);
  const cx = w / 2 / S,
    cy = Math.max(150, usable * 0.36) / S;
  const post = world.createBody({ type: "static", position: { x: cx, y: cy } });
  const beam = world.createBody({ type: "dynamic", position: { x: cx, y: cy }, angularDamping: 2.5 });
  beam.createFixture(new planck.Box(3.2, 0.08), { density: 1, filterGroupIndex: -1 });
  // The pans are part of the beam, so their weight turns it.
  const panL = new planck.Box(0.9, 0.06, { x: -3, y: 1.6 }, 0);
  const panR = new planck.Box(0.9, 0.06, { x: 3, y: 1.6 }, 0);
  beam.createFixture(panL, { density: 0.5 });
  beam.createFixture(panR, { density: 0.5 });
  for (const [x, y] of [[-3.85, 1.3], [-2.15, 1.3], [2.15, 1.3], [3.85, 1.3]]) beam.createFixture(new planck.Box(0.05, 0.35, { x, y }, 0), { density: 0.1 });
  world.createJoint(new planck.RevoluteJoint({ lowerAngle: -0.45, upperAngle: 0.45, enableLimit: true }, post, beam, { x: cx, y: cy }));
  const bodies = [];
  const drop = (weight, side, color) => {
    // Drop between the beam and the pan, so the stone lands in the pan.
    const a = beam.getAngle();
    const panX = cx + side * 3 * Math.cos(a) - 1.6 * Math.sin(a),
      panY = cy + side * 3 * Math.sin(a) + 1.6 * Math.cos(a);
    const b = world.createBody({ type: "dynamic", position: { x: panX + (Math.random() - 0.5) * 0.5, y: panY - 0.7 } });
    b.createFixture(new planck.Circle(0.18 + weight * 0.06), { density: weight * 3, friction: 0.8, restitution: 0.1 });
    bodies.push({ b, color, weight });
  };
  drop(need, -1, 0x5a5a4e); // the circle's doubt
  const chosen = new Map();
  let patience = Math.max(14, 10 + (profile.chance ?? 0.5) * 12);
  ui.say(`The elders set the circle’s doubt on one pan. Put what you know on the other. They will not wait for ever.`, "trial");
  ui.hint("Choose the things you know. Each one drops onto the scale.");
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      scene.events.off("update", tick);
      layer.destroy(true);
      ui.done();
      resolve(result);
    };
    const settle = () => {
      const total = [...chosen.values()].reduce((s, x) => s + x, 0);
      const pass = total >= need;
      ui.feedback(pass ? "The beam tips your way. The circle makes room for him." : "The beam does not move. The circle is not yet persuaded.", pass);
      setTimeout(() => finish({ mode: "skill", pass, score: Number(Math.min(1, total / need).toFixed(3)) }), 1100);
    };
    ui.onCancel(() => finish(null));
    ui.choices([
      ...stones.map((s) => ({
        label: `${s.label} · weight ${s.weight}`,
        pressed: () => chosen.has(s.id),
        act: () => {
          if (chosen.has(s.id)) return;
          chosen.set(s.id, s.weight);
          drop(s.weight, 1, 0xd8b56a);
        },
      })),
      { label: "Let the scale settle", act: settle, quiet: true },
    ]);
    const tick = (_t, deltaMs) => {
      const dt = Math.min(0.05, deltaMs / 1000);
      world.step(dt);
      patience -= dt;
      ui.hint(`The elders’ patience: ${Math.max(0, Math.ceil(patience))} heartbeats.`);
      if (patience <= 0 && !settled) settle();
      art.clear();
      const p = beam.getPosition(),
        a = beam.getAngle();
      const toScreen = (x, y) => ({ x: (p.x + x * Math.cos(a) - y * Math.sin(a)) * S, y: (p.y + x * Math.sin(a) + y * Math.cos(a)) * S });
      art.fillStyle(0x6a4b33).fillRect(cx * S - 8, cy * S, 16, usable * 0.5);
      art.fillStyle(0x4a3524).fillTriangle(cx * S - 40, cy * S + usable * 0.5, cx * S + 40, cy * S + usable * 0.5, cx * S, cy * S + usable * 0.45);
      const l = toScreen(-3.2, 0),
        r = toScreen(3.2, 0);
      art.lineStyle(8, 0xb08a52).lineBetween(l.x, l.y, r.x, r.y);
      for (const side of [-1, 1]) {
        const top = toScreen(side * 3, 0),
          pan = toScreen(side * 3, 1.6);
        art.lineStyle(2, 0xc9b27a).lineBetween(top.x, top.y, pan.x - 30, pan.y).lineBetween(top.x, top.y, pan.x + 30, pan.y);
        art.fillStyle(0x8a6a46).fillEllipse(pan.x, pan.y, 76, 12);
      }
      for (const { b, color, weight } of bodies) {
        const q = b.getPosition();
        art.fillStyle(color).fillCircle(q.x * S, q.y * S, (0.18 + weight * 0.06) * S);
      }
    };
    scene.events.on("update", tick);
  });
}
