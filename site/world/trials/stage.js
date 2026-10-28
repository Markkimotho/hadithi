// Trials, staged in first person. The rules come from core.js (tested and
// calibrated in Node); this file only draws them over the view and listens
// for the press.
//
// leap    the stepping stones of the ford: a ring closes on each stone in
//         turn, and a good press carries you onto it
// brace   the squall: gust shadows sweep in across the grass toward you
// balance the climb: the view gives way to the trunk, the pot swinging on its rope
// scale   the elders' circle: argument stones dropped on a real beam balance
// path    (steer, swim, sneak, carry, chase) rings on points ahead of you
// place   (formation, stack, rhythm) a ring closing on the crosshair
import { createTiming, paramsFor } from "./core.js";

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
  steer: {
    intro: "The current braids round rocks and eddies. Each one shows itself a breath before you reach it.",
    hint: "Press E or Space as the ring closes, to lean round it.",
    good: ["You slip past.", "Clean water.", "The turtle follows your lean."],
    bad: ["The eddy spins you round.", "Rock scrapes your shoulder.", "You lose the line of the current."],
  },
  swim: {
    intro: "The water runs backwards. Behind each pillar, slack water opens for a moment.",
    hint: "Press E or Space as the ring closes: pull then.",
    good: ["You reach the slack water.", "A good stroke.", "The pillar shelters you."],
    bad: ["The current takes back the stroke.", "You swallow sea.", "You are pushed back a length."],
  },
  sneak: {
    intro: "Every board has its own complaint. The sleepers stir and settle, stir and settle.",
    hint: "Press E or Space as the ring closes: that is the quiet moment to step.",
    good: ["Not a sound.", "The board holds its tongue.", "Someone snores on."],
    bad: ["The board groans.", "A sleeper mutters and turns.", "Something knocks a cup."],
  },
  carry: {
    intro: "The crowd moves like water. Gaps open and close.",
    hint: "Press E or Space as the ring closes on a gap.",
    good: ["Through, and nothing knocked.", "The jar rides steady.", "A gap, and you take it."],
    bad: ["An elbow catches the jar.", "You are jostled.", "The gap closes on you."],
  },
  chase: {
    intro: "He is close behind. Ahead, the crowd opens and shuts.",
    hint: "Press E or Space as the ring closes: duck through.",
    good: ["Through.", "You vanish behind a cart.", "He loses you for a moment."],
    bad: ["Blocked.", "A basket in your way.", "He gains on you."],
  },
  formation: {
    intro: "Four friends, one door, lantern light. Each one drifts as you go.",
    hint: "Press E or Space as the ring closes on whoever strays.",
    good: ["Back in line.", "Together.", "Shoulder to shoulder."],
    bad: ["The cat wanders off.", "The rooster flaps ahead.", "The dog stops to sniff."],
  },
  stack: {
    intro: "Dog on donkey, cat on dog, rooster on top. The tower sways.",
    hint: "Press E or Space as the ring closes: shift your weight.",
    good: ["The tower holds.", "Steady.", "Balanced."],
    bad: ["The tower lurches.", "Claws in your back.", "The rooster nearly falls."],
  },
  rhythm: {
    intro: "Feel the beat before you call. One voice at a time, then all of them.",
    hint: "Press E or Space as the ring closes, on the beat.",
    good: ["On the beat.", "Loud and true.", "The room shakes."],
    bad: ["Off the beat.", "A croak.", "The beat slips away."],
  },
};

/** How each timed kind is staged. */
export const STAGING = { leap: "stones", brace: "gusts", balance: "climb", steer: "path", swim: "path", sneak: "path", carry: "path", chase: "path", formation: "place", stack: "place", rhythm: "place" };

const css = (hex, a = 1) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;

/** A small Phaser-Graphics-like drawing helper over a 2D context. */
function gfx(ctx) {
  const g = {
    fill: (hex, a = 1) => ((ctx.fillStyle = css(hex, a)), g),
    stroke: (width, hex, a = 1) => ((ctx.lineWidth = width), (ctx.strokeStyle = css(hex, a)), g),
    circle(x, y, r, fill = true) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      fill ? ctx.fill() : ctx.stroke();
      return g;
    },
    ellipse(x, y, w, h) {
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      return g;
    },
    rect: (x, y, w, h) => (ctx.fillRect(x, y, w, h), g),
    line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      return g;
    },
    tri(x1, y1, x2, y2, x3, y3) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.fill();
      return g;
    },
    round(x, y, w, h, r) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      return g;
    },
  };
  return g;
}

/** The ring that closes on a moment: it meets its mark at the instant. */
function ring(g, x, y, t, i, { base = 18, tone = 0xf3dc9a, scale = 1 } = {}) {
  const r = (base + Math.max(0, t.times[i] - t.clock) * 70) * scale;
  g.stroke(4, 0x14100c, 0.55).circle(x, y, Math.min(r, 160 * scale) + 1, false);
  g.stroke(3, tone, 0.95).circle(x, y, Math.min(r, 160 * scale), false);
  g.stroke(2, tone, 0.4).circle(x, y, base * scale, false);
}

/**
 * Run one trial. Resolves to { mode: "skill", pass, score } or null if the
 * player steps back.
 * @param stage   the world's trial stage (see boot.js trialStage)
 * @param kind    skill kind
 * @param profile from bridge.profile(): odds, clues, deductions, flags
 * @param ui      { say(text), hint(text), feedback(text, good), done(), onCancel(fn), choices(list), bandHeight() }
 */
export function playTrial(stage, kind, profile, ui, seed) {
  if (kind === "scale") return scaleTrial(stage, profile, ui);
  const params = paramsFor(kind, profile);
  const trial = createTiming(params, seed);
  const text = TEXT[kind] ?? TEXT.leap;
  const staging = STAGING[kind] ?? "place";
  const view =
    staging === "stones" ? leapView(stage, trial)
    : staging === "gusts" ? braceView(stage, trial)
    : staging === "climb" ? balanceView(stage, trial, profile, ui)
    : staging === "path" ? pathView(stage, trial, kind)
    : placeView(stage, trial, kind);
  ui.say(`${text.intro} ${params.need === params.moments ? "Every one" : `${params.need} of ${params.moments}`} must go well.`, "trial");
  ui.hint(text.hint);
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      stage.offTick(tick);
      stage.setPress(null);
      stage.setInfo(null);
      stage.clear();
      view.destroy();
      ui.done();
      resolve(result);
    };
    ui.onCancel(() => finish(null));
    stage.setPress(() => {
      const r = trial.press();
      if (!r) return;
      ui.feedback((r.good ? text.good : text.bad)[r.index % 3], r.good);
      view.answer(r.index, r.good, r.error);
    });
    let ending = 0;
    // What the test driver may read: the next instant, never the answer.
    stage.setInfo(() => ({ kind, next: trial.current() >= 0 ? trial.times[trial.current()] - trial.clock : null, done: trial.done, good: trial.good }));
    const tick = (dt) => {
      const before = trial.answers.map((a) => a?.missed);
      trial.advance(Math.min(0.05, dt));
      trial.answers.forEach((a, i) => {
        if (a?.missed && !before[i]) {
          ui.feedback(text.bad[i % 3], false);
          view.answer(i, false, null);
        }
      });
      stage.clear();
      view.draw(trial, gfx(stage.overlay.ctx));
      if (trial.done) {
        ending += dt;
        if (ending > 0.9) finish({ mode: "skill", pass: trial.pass, score: trial.score });
      }
    };
    stage.onTick(tick);
  });
}

// ── Leap: the stepping stones, seen ahead of you ──────────────────────────
function leapView(stage, trial) {
  const start = stage.player();
  const f = stage.facing();
  // Stones are the props of kind "stone"; nearest first.
  let stones = stage
    .props()
    .filter((p) => p.kind === "stone")
    .map((p) => ({ x: p.at[0] + 0.5, y: p.at[1] + 0.5 }))
    .sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
  if (stones.length < trial.times.length)
    stones = Array.from({ length: trial.times.length }, (_, i) => ({ x: start.x + f.x * 1.4 * (i + 1), y: start.y + f.y * 1.4 * (i + 1) }));
  stage.face(stones[0].x, stones[0].y);
  return {
    draw(t, g) {
      const i = t.current();
      stones.slice(0, t.times.length).forEach((s, k) => {
        const p = stage.project(s.x, s.y, 0.15);
        if (!p) return;
        const scale = Math.max(0.5, Math.min(2.2, 3 / p.depth));
        const rise = k === i ? t.nearness() : 0;
        g.fill(0xd8e7df, 0.16 + rise * 0.34).ellipse(p.x, p.y, 70 * scale, 22 * scale);
        if (k === i) ring(g, p.x, p.y - rise * 8, t, i, { scale });
      });
    },
    answer(i, good) {
      const s = stones[i] ?? stones.at(-1);
      stage.glideTo(s.x, s.y, 260);
      stage.fx("hop", 300);
      const next = stones[i + 1];
      if (next) setTimeout(() => stage.face(next.x, next.y), 280);
      if (!good) {
        stage.fx("dip", 420, 1.4);
        stage.fx("shake", 200, 1);
      }
    },
    destroy() {
      // Across, or not: the story moves you where the leap left you.
      stage.endGlide();
    },
  };
}

// ── Brace: gust shadows sweep in toward you ───────────────────────────────
function braceView(stage, trial) {
  return {
    draw(t, g) {
      const { width: w, height: h } = stage.overlay;
      t.times.forEach((time, i) => {
        if (t.answers[i]) return;
        // Each gust crosses from the right edge to the middle of the screen in one period.
        const x = w / 2 + (time - t.clock) * (w / 2.2);
        if (x < -80 || x > w + 120) return;
        g.fill(0x0f1a14, 0.3).rect(x - 40, 0, 80, h);
        g.fill(0xdfe8dc, 0.2).rect(x - 46, 0, 5, h);
      });
      // Where you stand: a mark under the crosshair.
      g.stroke(4, 0xf3dc9a, 0.85).line(w / 2, h * 0.32, w / 2, h * 0.68);
    },
    answer(_i, good) {
      if (good) stage.fx("dip", 340);
      else {
        const f = stage.facing();
        stage.shove(f.y * 2.4, -f.x * 2.4);
        stage.fx("shake", 220, 1.2);
      }
    },
    destroy() {},
  };
}

// ── Path: rings on points ahead; each good answer carries you on ──────────
function pathView(stage, trial, kind) {
  const start = stage.player();
  const f = stage.facing();
  const n = trial.times.length;
  // Points ahead of you, a little zig-zag so each one is its own place.
  const points = Array.from({ length: n }, (_, i) => ({
    x: start.x + f.x * 1.3 * (i + 1) - f.y * (i % 2 ? 0.35 : -0.35),
    y: start.y + f.y * 1.3 * (i + 1) + f.x * (i % 2 ? 0.35 : -0.35),
  }));
  const tone = { steer: 0x9fd0c8, swim: 0x9fd0c8, sneak: 0xe0c47a }[kind] ?? 0xf3dc9a;
  return {
    draw(t, g) {
      const i = t.current();
      points.forEach((pt, k) => {
        if (t.answers[k]) return;
        const p = stage.project(pt.x, pt.y, 0.05);
        if (!p) return;
        const scale = Math.max(0.5, Math.min(2.2, 3 / p.depth));
        g.fill(tone, k === i ? 0.4 : 0.14).ellipse(p.x, p.y, 40 * scale, 14 * scale);
        if (k === i) ring(g, p.x, p.y, t, i, { tone, scale });
      });
    },
    answer(i, good) {
      const p = points[i];
      stage.glideTo(good ? p.x : p.x + f.y * 0.4, good ? p.y : p.y - f.x * 0.4, 280);
      if (!good) stage.fx("shake", 200, 1);
    },
    destroy() {
      stage.endGlide();
    },
  };
}

// ── Place: a ring closing on the crosshair ────────────────────────────────
function placeView(stage, trial, kind) {
  const tone = kind === "rhythm" ? 0xe8a04d : 0xf3dc9a;
  return {
    draw(t, g) {
      const i = t.current();
      if (i < 0) return;
      const { width: w, height: h } = stage.overlay;
      ring(g, w / 2, h / 2, t, i, { base: 26, tone, scale: 1.2 });
    },
    answer(_i, good) {
      if (good) stage.fx(kind === "rhythm" ? "talk" : "dip", 260);
      else stage.fx("shake", 200, 1);
    },
    destroy() {},
  };
}

// ── Balance: the climb, with the pot swinging on its rope ─────────────────
function balanceView(stage, trial, profile, ui) {
  const behind = profile.flags?.includes("behind") || profile.flags?.includes("knotTaught");
  let theta = 0.3,
    omega = 0,
    climb = 0;
  const L = behind ? 38 : 68;
  return {
    draw(t, g) {
      const { width: w, height: fullH } = stage.overlay;
      // Draw in the space above the story band.
      const h = fullH - (ui.bandHeight?.() ?? fullH * 0.32) - 20;
      const cx = w / 2;
      g.fill(0x182114, 0.96).rect(0, 0, w, fullH);
      for (let i = 0; i < 9; i++) g.fill(0x223020).circle((i * 173) % w, h * 0.2 + ((i * 97) % 120), 90);
      g.fill(0x7d6950).rect(cx - 50, 0, 100, fullH);
      g.stroke(3, 0x5a4a37, 0.7);
      for (let i = -2; i <= 2; i++) g.line(cx + i * 17, 0, cx + i * 18, fullH);
      const leaf = (x, y, r, seed) => {
        for (let k = 0; k < 9; k++) {
          const a = (k * 2.4 + seed) % (Math.PI * 2);
          g.fill(k % 3 ? 0x3d5c35 : 0x4d6d3f).circle(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.45, r * (0.35 + (k % 4) * 0.08));
        }
      };
      leaf(cx + 190, h * 0.25, 90, 1);
      leaf(cx - 210, h * 0.55, 80, 2);
      leaf(cx + 230, h * 0.8, 70, 3);
      // The ledge above: where the climb ends.
      g.fill(0x6c5a45).round(cx - 10, 26, 210, 22, 10);
      g.fill(0x4d6d3f).circle(cx + 200, 30, 26);
      const dt = 1 / 60;
      const base = h * 0.78,
        goal = h * 0.5;
      const i = t.current();
      const pushT = i >= 0 ? t.times[i] - t.clock : 9;
      const force = pushT > 0 && pushT < 0.35 ? Math.sin(t.clock * 9) * 6 : 0;
      omega += (-(9.8 / (L / 40)) * Math.sin(theta) * 0.6 + force - omega * (behind ? 1.6 : 0.7)) * dt;
      theta += omega * dt;
      // He climbs steadily; each good answer is a hand-hold gained.
      climb = Math.min(goal, climb + dt * (goal / (t.times.at(-1) + 1)));
      const y = base - climb;
      const hand = { x: cx + (behind ? -16 : 24), y: y - 4 };
      g.stroke(7, 0x3f2c20).line(cx - 4, y + 20, cx - 16, y + 46).line(cx + 12, y + 20, cx + 22, y + 44);
      g.fill(0xe0ba69).round(cx - 10, y - 26, 28, 46, 7);
      g.fill(0x7a4e35).circle(cx + 4, y - 40, 13);
      g.fill(0x221b14).ellipse(cx + 4, y - 50, 22, 10);
      g.stroke(7, 0x7a4e35).line(cx - 6, y - 18, cx - 34, y - 42).line(cx + 14, y - 16, hand.x, hand.y);
      const px = hand.x + Math.sin(theta) * L,
        py = hand.y + Math.cos(theta) * L;
      g.stroke(3, 0xc9b27a).line(hand.x, hand.y, px, py);
      g.fill(0x6e4430).ellipse(px, py + 16, 50, 46);
      g.fill(0xa86f4c).ellipse(px - 6, py + 12, 32, 30);
      g.fill(0xb8402c).circle(px - 5, py - 4, 4);
      if (i >= 0) ring(g, px, py + 16, t, i, { base: 24 });
    },
    answer(_i, good) {
      if (good) omega *= 0.3;
      else {
        omega += theta > 0 ? 2.2 : -2.2;
        climb = Math.max(0, climb - 24);
        stage.fx("shake", 160, 1);
      }
    },
    destroy() {},
  };
}

// ── Scale: arguments on a beam balance ────────────────────────────────────
/**
 * The doubt on the other pan is what an average roll (7) would need, so the
 * scale is exactly as fair as the dice. The arguments you can lay on it are
 * the advantages you have earned for this check, one stone each.
 */
export function scaleNeed(profile) {
  return Math.max(0, (profile.dc ?? 8) - 7);
}
export function scaleStones(profile) {
  return (profile.parts ?? []).filter((p) => p.value > 0).map((p, i) => ({ id: `s${i}`, label: p.label, weight: p.value }));
}

function scaleTrial(stage, profile, ui) {
  const planck = stage.planck;
  const need = scaleNeed(profile);
  const stones = scaleStones(profile);
  const { width: w, height: h } = stage.overlay;
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
  beam.createFixture(new planck.Box(0.9, 0.06, { x: -3, y: 1.6 }, 0), { density: 0.5 });
  beam.createFixture(new planck.Box(0.9, 0.06, { x: 3, y: 1.6 }, 0), { density: 0.5 });
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
  if (need > 0) drop(need, -1, 0x5a5a4e); // the doubt
  const chosen = new Map();
  let patience = 20;
  ui.say(profile.skill?.intro ?? "Doubt sits on one pan. Lay what you have on the other. Nobody will wait for ever.", "trial");
  ui.hint(stones.length ? "Choose what to lay on the scale. Each one drops onto the pan." : "You have nothing to lay on the scale yet. Learn more, then ask again.");
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      stage.offTick(tick);
      stage.clear();
      ui.done();
      resolve(result);
    };
    const settle = () => {
      const total = [...chosen.values()].reduce((s, x) => s + x, 0);
      const pass = total >= need;
      ui.feedback(pass ? (profile.skill?.won ?? "The beam tips your way.") : (profile.skill?.lost ?? "The beam does not move. Not yet."), pass);
      setTimeout(() => finish({ mode: "skill", pass, score: Number(Math.min(1, need ? total / need : 1).toFixed(3)) }), 1100);
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
    const tick = (dt) => {
      world.step(Math.min(0.05, dt));
      patience -= dt;
      ui.hint(`${profile.skill?.patienceLabel ?? "Patience"}: ${Math.max(0, Math.ceil(patience))} heartbeats.`);
      if (patience <= 0 && !settled) settle();
      stage.clear();
      const g = gfx(stage.overlay.ctx);
      g.fill(0x161b13, 0.88).rect(0, 0, w, h);
      const p = beam.getPosition(),
        a = beam.getAngle();
      const toScreen = (x, y) => ({ x: (p.x + x * Math.cos(a) - y * Math.sin(a)) * S, y: (p.y + x * Math.sin(a) + y * Math.cos(a)) * S });
      g.fill(0x6a4b33).rect(cx * S - 8, cy * S, 16, usable * 0.5);
      g.fill(0x4a3524).tri(cx * S - 40, cy * S + usable * 0.5, cx * S + 40, cy * S + usable * 0.5, cx * S, cy * S + usable * 0.45);
      const l = toScreen(-3.2, 0),
        r = toScreen(3.2, 0);
      g.stroke(8, 0xb08a52).line(l.x, l.y, r.x, r.y);
      for (const side of [-1, 1]) {
        const top = toScreen(side * 3, 0),
          pan = toScreen(side * 3, 1.6);
        g.stroke(2, 0xc9b27a).line(top.x, top.y, pan.x - 30, pan.y).line(top.x, top.y, pan.x + 30, pan.y);
        g.fill(0x8a6a46).ellipse(pan.x, pan.y, 76, 12);
      }
      for (const { b, color, weight } of bodies) {
        const q = b.getPosition();
        g.fill(color).circle(q.x * S, q.y * S, (0.18 + weight * 0.06) * S);
      }
    };
    stage.onTick(tick);
  });
}
