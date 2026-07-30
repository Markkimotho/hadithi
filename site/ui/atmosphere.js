// Weather drawn over the scene art: rain, storm, mist, bubbles, fireflies,
// leaves, dust, lanterns, stars. One canvas, one animation loop, and a static
// single frame when motion is off. Particle state survives re-renders so the
// weather does not restart every time the player acts.

const COUNTS = {
  rain: 140,
  storm: 260,
  mist: 9,
  bubbles: 28,
  fireflies: 22,
  leaves: 18,
  dust: 40,
  lanterns: 14,
  stars: 70,
};

let canvas = null;
let ctx = null;
let weather = "none";
let particles = [];
let motion = true;
let frame = 0;
let flash = 0;
let last = 0;
let size = { w: 0, h: 0 };
let seed = 1;
const random = () => {
  // Deterministic sparkle so screenshots are stable when motion is off.
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function spawn(kind, fresh) {
  const { w, h } = size;
  const p = { x: random() * w, y: fresh ? random() * h : -10, life: random() };
  switch (kind) {
    case "rain":
    case "storm":
      p.len = 8 + random() * (kind === "storm" ? 18 : 10);
      p.v = (kind === "storm" ? 900 : 600) + random() * 300;
      p.wind = kind === "storm" ? 0.35 : 0.18;
      break;
    case "mist":
      p.r = (0.25 + random() * 0.35) * w;
      p.y = h * (0.35 + random() * 0.6);
      p.v = 4 + random() * 8;
      p.a = 0.05 + random() * 0.06;
      break;
    case "bubbles":
      p.y = fresh ? random() * h : h + 10;
      p.r = 1.5 + random() * 4;
      p.v = 18 + random() * 35;
      p.phase = random() * 6;
      break;
    case "fireflies":
      p.y = h * (0.35 + random() * 0.6);
      p.r = 1.2 + random() * 1.6;
      p.phase = random() * 6;
      p.speed = 0.3 + random() * 0.6;
      break;
    case "leaves":
      p.s = 3 + random() * 4;
      p.v = 25 + random() * 30;
      p.spin = random() * 6;
      break;
    case "dust":
      p.r = 0.6 + random() * 1.4;
      p.v = 3 + random() * 6;
      p.phase = random() * 6;
      break;
    case "lanterns":
      p.y = h * (0.15 + random() * 0.55);
      p.r = 2 + random() * 5;
      p.phase = random() * 6;
      break;
    case "stars":
      p.y = random() * h * 0.55;
      p.r = 0.4 + random() * 1.1;
      p.phase = random() * 6;
      break;
  }
  return p;
}

function resize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (w === size.w && h === size.h) return;
  const old = size;
  size = { w, h };
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!old.w) return;
  // Keep particles in proportion when the stage changes size.
  for (const p of particles) {
    p.x *= w / old.w;
    p.y *= h / old.h;
  }
}

function step(dt, t) {
  const { w, h } = size;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    switch (weather) {
      case "rain":
      case "storm":
        p.y += p.v * dt;
        p.x += p.v * p.wind * dt;
        if (p.y > h || p.x > w + 20) Object.assign(p, spawn(weather, false), { x: random() * w * 1.2 - w * 0.2 });
        break;
      case "mist":
        p.x += p.v * dt;
        if (p.x - p.r > w) p.x = -p.r;
        break;
      case "bubbles":
        p.y -= p.v * dt;
        p.x += Math.sin(t / 600 + p.phase) * 0.3;
        if (p.y < -10) Object.assign(p, spawn("bubbles", false));
        break;
      case "fireflies":
        p.x += Math.cos(t / 1400 * p.speed + p.phase) * 0.35;
        p.y += Math.sin(t / 1100 * p.speed + p.phase) * 0.25;
        break;
      case "leaves":
        p.y += p.v * dt;
        p.x += Math.sin(t / 700 + p.spin) * 0.6;
        p.spin += dt;
        if (p.y > h + 10) Object.assign(p, spawn("leaves", false));
        break;
      case "dust":
        p.x += p.v * dt;
        p.y += Math.sin(t / 2000 + p.phase) * 0.08;
        if (p.x > w + 5) p.x = -5;
        break;
    }
  }
  if (weather === "storm") {
    flash = Math.max(0, flash - dt * 2.5);
    if (random() < dt * 0.12) flash = 1;
  }
}

function draw(t) {
  const { w, h } = size;
  ctx.clearRect(0, 0, w, h);
  if (weather === "none") return;
  if (weather === "rain" || weather === "storm") {
    ctx.strokeStyle = weather === "storm" ? "rgba(214,226,214,0.42)" : "rgba(214,226,214,0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of particles) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.len * p.wind, p.y - p.len);
    }
    ctx.stroke();
    if (flash > 0) {
      ctx.fillStyle = `rgba(235,240,220,${flash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }
  for (const p of particles) {
    switch (weather) {
      case "mist": {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(220,226,210,${p.a})`);
        g.addColorStop(1, "rgba(220,226,210,0)");
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        break;
      }
      case "bubbles":
        ctx.strokeStyle = "rgba(220,240,232,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "fireflies": {
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(t / 700 + p.phase * 3));
        ctx.fillStyle = `rgba(232,224,140,${a})`;
        ctx.shadowColor = "rgba(232,224,140,0.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case "leaves":
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = "rgba(170,120,70,0.7)";
        ctx.fillRect(-p.s, -p.s / 3, p.s * 2, (p.s * 2) / 3);
        ctx.restore();
        break;
      case "dust":
        ctx.fillStyle = "rgba(240,220,170,0.35)";
        ctx.fillRect(p.x, p.y, p.r, p.r);
        break;
      case "lanterns": {
        const a = 0.25 + 0.2 * Math.sin(t / 900 + p.phase);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(240,190,110,${a + 0.2})`);
        g.addColorStop(1, "rgba(240,190,110,0)");
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8);
        break;
      }
      case "stars": {
        const a = 0.35 + 0.5 * Math.abs(Math.sin(t / 1300 + p.phase));
        ctx.fillStyle = `rgba(240,236,214,${a})`;
        ctx.fillRect(p.x, p.y, p.r * 1.6, p.r * 1.6);
        break;
      }
    }
  }
}

function loop(t) {
  frame = 0;
  if (!canvas?.isConnected) return;
  const dt = Math.min(0.05, (t - last) / 1000 || 0);
  last = t;
  resize();
  step(dt, t);
  draw(t);
  if (motion && weather !== "none" && !document.hidden) frame = requestAnimationFrame(loop);
}

/**
 * Attach to a freshly rendered stage canvas and set the weather. Calling it
 * again with the same weather keeps existing particles.
 */
export function mountWeather(element, nextWeather, allowMotion) {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  canvas = element;
  ctx = canvas?.getContext?.("2d") ?? null;
  motion = allowMotion;
  if (!ctx) return;
  size = { w: 0, h: 0 };
  resize();
  if (nextWeather !== weather || !particles.length) {
    weather = nextWeather in COUNTS ? nextWeather : "none";
    seed = 7;
    particles = Array.from({ length: COUNTS[weather] ?? 0 }, () => spawn(weather, true));
  }
  if (motion && weather !== "none") {
    last = performance.now();
    frame = requestAnimationFrame(loop);
  } else {
    draw(1200);
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && canvas?.isConnected && motion && weather !== "none" && !frame) {
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }
});
globalThis.addEventListener?.("resize", () => {
  if (canvas?.isConnected && !motion) {
    resize();
    draw(1200);
  }
});
