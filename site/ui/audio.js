// Procedural sound. Ambiences and effects are synthesized with WebAudio from
// noise and oscillators: no audio files, nothing to license, tiny download.
// Silent until the player turns sound on; context starts on a user gesture.

let ctx = null;
let master = null;
let noise = null;
let current = null; // { name, gain, stop }
let wanted = "none";
let options = { sfx: false, ambience: false, volume: 0.6 };

function ensure() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const compressor = ctx.createDynamicsCompressor();
  master = ctx.createGain();
  master.gain.value = options.volume;
  master.connect(compressor).connect(ctx.destination);
  noise = buildNoise();
  return ctx;
}

function buildNoise() {
  const length = ctx.sampleRate * 3;
  const make = (fill) => {
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    fill(buffer.getChannelData(0));
    return buffer;
  };
  const white = make((d) => {
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  });
  const pink = make((d) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  });
  const brown = make((d) => {
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
  });
  return { white, pink, brown };
}

const now = () => ctx.currentTime;

function source(kind) {
  const s = ctx.createBufferSource();
  s.buffer = noise[kind];
  s.loop = true;
  s.start(now() + Math.random() * 0.01, Math.random() * 2);
  return s;
}
function filter(type, frequency, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}
function lfo(target, rate, depth, base) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = rate;
  g.gain.value = depth;
  target.value = base;
  o.connect(g).connect(target);
  o.start();
  return o;
}

/** Each ambience returns { nodes to stop, timers to clear } feeding `out`. */
const AMBIENCES = {
  wind(out) {
    const s = source("brown");
    const f = filter("lowpass", 500);
    const g = ctx.createGain();
    const l = lfo(g.gain, 0.07, 0.35, 0.6);
    const l2 = lfo(f.frequency, 0.05, 200, 520);
    s.connect(f).connect(g).connect(out);
    return { nodes: [s, l, l2] };
  },
  forest(out) {
    const base = AMBIENCES.wind(out, 0.5);
    const timers = [];
    const chirp = () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = now();
      const f0 = 2200 + Math.random() * 1800;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.5), t + 0.08);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.15);
      timers.push(setTimeout(chirp, 1800 + Math.random() * 5200));
    };
    timers.push(setTimeout(chirp, 900));
    return { nodes: base.nodes, timers };
  },
  river(out) {
    const s = source("pink");
    const f = filter("bandpass", 900, 0.5);
    const g = ctx.createGain();
    const l = lfo(g.gain, 0.9, 0.12, 0.7);
    s.connect(f).connect(g).connect(out);
    return { nodes: [s, l] };
  },
  rain(out) {
    const s = source("white");
    const hp = filter("highpass", 1400);
    const lp = filter("lowpass", 7000);
    const g = ctx.createGain();
    g.gain.value = 0.45;
    s.connect(hp).connect(lp).connect(g).connect(out);
    const rumble = source("brown");
    const rl = filter("lowpass", 180);
    const rg = ctx.createGain();
    rg.gain.value = 0.5;
    rumble.connect(rl).connect(rg).connect(out);
    return { nodes: [s, rumble] };
  },
  sea(out) {
    const s = source("brown");
    const f = filter("lowpass", 650);
    const g = ctx.createGain();
    const l = lfo(g.gain, 0.12, 0.55, 0.6);
    const hiss = source("pink");
    const hf = filter("bandpass", 2500, 0.4);
    const hg = ctx.createGain();
    const hl = lfo(hg.gain, 0.12, 0.08, 0.09);
    s.connect(f).connect(g).connect(out);
    hiss.connect(hf).connect(hg).connect(out);
    return { nodes: [s, l, hiss, hl] };
  },
  underwater(out) {
    const s = source("brown");
    const f = filter("lowpass", 240);
    const g = ctx.createGain();
    const l = lfo(g.gain, 0.05, 0.25, 0.9);
    s.connect(f).connect(g).connect(out);
    const timers = [];
    const bubble = () => {
      const o = ctx.createOscillator();
      const bg = ctx.createGain();
      const t = now();
      o.type = "sine";
      o.frequency.setValueAtTime(280 + Math.random() * 200, t);
      o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 600, t + 0.09);
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(0.035, t + 0.01);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(bg).connect(out);
      o.start(t);
      o.stop(t + 0.12);
      timers.push(setTimeout(bubble, 600 + Math.random() * 2600));
    };
    timers.push(setTimeout(bubble, 500));
    return { nodes: [s, l], timers };
  },
  hall(out) {
    const nodes = [];
    for (const [freq, level] of [
      [110, 0.05],
      [164.8, 0.035],
      [220.5, 0.02],
    ]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const l = lfo(g.gain, 0.1 + Math.random() * 0.1, level * 0.5, level);
      o.connect(g).connect(out);
      o.start();
      nodes.push(o, l);
    }
    const water = AMBIENCES.underwater(out);
    return { nodes: [...nodes, ...water.nodes], timers: water.timers };
  },
  market(out) {
    const s = source("pink");
    const f = filter("bandpass", 650, 0.9);
    const g = ctx.createGain();
    const l = lfo(g.gain, 0.3, 0.25, 0.55);
    s.connect(f).connect(g).connect(out);
    const timers = [];
    const clink = () => {
      const o = ctx.createOscillator();
      const cg = ctx.createGain();
      const t = now();
      o.type = "triangle";
      o.frequency.value = 1800 + Math.random() * 1400;
      cg.gain.setValueAtTime(0.025, t);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(cg).connect(out);
      o.start(t);
      o.stop(t + 0.4);
      timers.push(setTimeout(clink, 2500 + Math.random() * 6000));
    };
    timers.push(setTimeout(clink, 1500));
    return { nodes: [s, l], timers };
  },
  court(out) {
    const m = AMBIENCES.market(out);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 98;
    g.gain.value = 0.02;
    o.connect(g).connect(out);
    o.start();
    return { nodes: [...m.nodes, o], timers: m.timers };
  },
  night(out) {
    const w = AMBIENCES.wind(out);
    const o = ctx.createOscillator();
    const am = ctx.createGain();
    const g = ctx.createGain();
    o.frequency.value = 4400;
    am.gain.value = 0;
    g.gain.value = 0.012;
    const trill = lfo(am.gain, 28, 1, 0);
    const pulse = ctx.createGain();
    const swell = lfo(pulse.gain, 0.4, 0.5, 0.5);
    o.connect(am).connect(pulse).connect(g).connect(out);
    o.start();
    return { nodes: [...w.nodes, o, trill, swell] };
  },
};

function startAmbience(name) {
  const build = AMBIENCES[name];
  if (!build) return null;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now());
  gain.gain.exponentialRampToValueAtTime(0.25, now() + 1.6);
  gain.connect(master);
  const { nodes = [], timers = [] } = build(gain);
  return {
    name,
    gain,
    stop() {
      timers.forEach(clearTimeout);
      gain.gain.cancelScheduledValues(now());
      gain.gain.setValueAtTime(gain.gain.value, now());
      gain.gain.exponentialRampToValueAtTime(0.0001, now() + 1.2);
      setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        });
        gain.disconnect();
      }, 1400);
    },
  };
}

/** Request an ambience; it plays only while ambience is enabled. */
export function setAmbience(name) {
  wanted = name || "none";
  if (!options.ambience || !ensure()) return;
  if (current?.name === wanted) return;
  current?.stop();
  current = wanted === "none" ? null : startAmbience(wanted);
}

export function configure(next) {
  options = { ...options, ...next };
  if (!options.sfx && !options.ambience) {
    current?.stop();
    current = null;
    return;
  }
  if (!ensure()) return;
  ctx.resume?.();
  master.gain.setTargetAtTime(options.volume, now(), 0.05);
  if (!options.ambience) {
    current?.stop();
    current = null;
  } else setAmbience(wanted);
}

/** Stop everything (page hidden); resumes on the next configure/setAmbience. */
export function pause() {
  ctx?.suspend?.();
}
export function resume() {
  if (options.sfx || options.ambience) ctx?.resume?.();
}

function tone({ type = "sine", freq, to, start = 0, attack = 0.005, decay = 0.25, level = 0.12 }) {
  const t = now() + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + decay);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}
function burst({ start = 0, decay = 0.08, freq = 3000, q = 1, level = 0.2, kind = "white" }) {
  const t = now() + start;
  const s = ctx.createBufferSource();
  s.buffer = noise[kind];
  const f = filter("bandpass", freq, q);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 2);
  s.stop(t + decay + 0.05);
}

const EFFECTS = {
  click: () => tone({ type: "triangle", freq: 180, decay: 0.08, level: 0.05 }),
  take: () => {
    tone({ freq: 523, decay: 0.12, level: 0.07 });
    tone({ freq: 784, start: 0.08, decay: 0.2, level: 0.07 });
  },
  dice: () => {
    for (let i = 0; i < 7; i++)
      burst({ start: i * 0.07 + Math.random() * 0.03, decay: 0.04, freq: 2500 + Math.random() * 2000, q: 3, level: 0.25 });
  },
  success: () =>
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone({ freq: f, start: 0.55 + i * 0.07, decay: 0.7, level: 0.06 })),
  failure: () => {
    tone({ freq: 150, to: 60, start: 0.55, decay: 0.45, level: 0.14 });
    burst({ start: 0.55, decay: 0.2, freq: 300, q: 0.7, level: 0.15, kind: "brown" });
  },
  interrupt: () => {
    tone({ freq: 80, to: 45, decay: 0.6, level: 0.2 });
    burst({ decay: 0.3, freq: 500, q: 0.5, level: 0.2, kind: "brown" });
    tone({ freq: 80, to: 45, start: 0.22, decay: 0.5, level: 0.14 });
  },
  deduction: () => {
    tone({ freq: 880, decay: 1.2, level: 0.07 });
    tone({ freq: 1320, start: 0.01, decay: 0.9, level: 0.035 });
    tone({ freq: 1760, start: 0.12, decay: 0.8, level: 0.03 });
  },
  wrong: () => tone({ type: "square", freq: 140, to: 120, decay: 0.15, level: 0.025 }),
  ending: () =>
    [392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => tone({ freq: f, start: i * 0.13, decay: 1.1, level: 0.055 })),
  thunder: () => burst({ decay: 2.4, freq: 120, q: 0.5, level: 0.5, kind: "brown" }),
};

export function sfx(name) {
  if (!options.sfx || !ensure()) return;
  try {
    ctx.resume?.();
    EFFECTS[name]?.();
  } catch {
    /* Sound is optional. */
  }
}

export const ambienceNames = Object.keys(AMBIENCES);
