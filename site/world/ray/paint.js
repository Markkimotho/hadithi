// A tiny software painter for the procedural art. A texture is
// { w, h, data: Uint32Array } in the byte order ImageData uses (RGBA in
// memory, so 0xAABBGGRR as a little-endian integer). Pure: the gate tests
// paint and check every texture and sprite in Node.
import { mulberry32 } from "../../engine/rng.js";

export const texture = (w, h) => ({ w, h, data: new Uint32Array(w * h) });

export const pack = (r, g, b, a = 255) =>
  (((a & 255) << 24) | ((Math.max(0, Math.min(255, b)) & 255) << 16) | ((Math.max(0, Math.min(255, g)) & 255) << 8) | (Math.max(0, Math.min(255, r)) & 255)) >>> 0;
export const unpack = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];

/** "#a0522d" or [r, g, b] → [r, g, b]. */
export function rgb(color) {
  if (Array.isArray(color)) return color;
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** Blend one pixel; alpha 0..1. */
export function plot(t, x, y, color, alpha = 1) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= t.w || y >= t.h || alpha <= 0) return;
  const i = y * t.w + x;
  const c = rgb(color);
  if (alpha >= 1) {
    t.data[i] = pack(c[0], c[1], c[2]);
    return;
  }
  const [r, g, b, a] = unpack(t.data[i]);
  const out = a / 255;
  const na = alpha + out * (1 - alpha);
  const k = (v, w) => (v * alpha + w * out * (1 - alpha)) / (na || 1);
  t.data[i] = pack(k(c[0], r), k(c[1], g), k(c[2], b), Math.round(na * 255));
}

export function rect(t, x, y, w, h, color, alpha = 1) {
  for (let j = Math.max(0, y | 0); j < Math.min(t.h, (y + h) | 0); j++)
    for (let i = Math.max(0, x | 0); i < Math.min(t.w, (x + w) | 0); i++) plot(t, i, j, color, alpha);
}

/** Filled ellipse. `light` (0..1) shades it as a lit dome, brighter up and left. */
export function ellipse(t, cx, cy, rx, ry, color, { alpha = 1, light = 0 } = {}) {
  const c = rgb(color);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx,
        dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const k = light ? 1 + light * (0.35 - 0.55 * (dx * 0.55 + dy * 0.75) - 0.25 * d) : 1;
      plot(t, x, y, shade(c, k), alpha);
    }
}

/** Filled convex or concave polygon (even-odd rule). */
export function polygon(t, points, color, alpha = 1) {
  const ys = points.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    const sy = y + 0.5;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i],
        [x2, y2] = points[(i + 1) % points.length];
      if (y1 <= sy !== y2 <= sy) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) plot(t, x, y, color, alpha);
  }
}

/** A thick line with round ends. */
export function line(t, x1, y1, x2, y2, width, color, alpha = 1) {
  const r = width / 2;
  const minX = Math.floor(Math.min(x1, x2) - r),
    maxX = Math.ceil(Math.max(x1, x2) + r);
  const minY = Math.floor(Math.min(y1, y2) - r),
    maxY = Math.ceil(Math.max(y1, y2) + r);
  const dx = x2 - x1,
    dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      const u = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
      if (Math.hypot(px - x1 - u * dx, py - y1 - u * dy) <= r) plot(t, x, y, color, alpha);
    }
}

/** Smooth value noise in 0..1, tiling every `period` cells. */
export function noise2(seed, period = 8) {
  const rand = mulberry32(seed);
  const grid = Array.from({ length: period * period }, () => rand());
  const at = (x, y) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  const fade = (v) => v * v * (3 - 2 * v);
  return (x, y) => {
    const x0 = Math.floor(x),
      y0 = Math.floor(y);
    const fx = fade(x - x0),
      fy = fade(y - y0);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** Several octaves of tiling noise over a w×h texture, 0..1. */
export function fbm(seed, w, octaves = 4, base = 4) {
  const layers = Array.from({ length: octaves }, (_, i) => ({ n: noise2(seed + i * 7919, base << i), f: (base << i) / w, a: 0.5 ** i }));
  const total = layers.reduce((s, l) => s + l.a, 0);
  return (x, y) => layers.reduce((s, l) => s + l.n(x * l.f, y * l.f) * l.a, 0) / total;
}

/** Fill the whole texture from a function (x, y) → [r, g, b]. */
export function fill(t, fn) {
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      const c = fn(x, y);
      t.data[y * t.w + x] = pack(c[0], c[1], c[2]);
    }
  return t;
}

/** Darken the outline of whatever is already drawn: a one-pixel ink edge. */
export function outline(t, color = [28, 20, 16], alpha = 0.85) {
  const solid = (x, y) => x >= 0 && y >= 0 && x < t.w && y < t.h && t.data[y * t.w + x] >>> 24 > 127;
  const edge = [];
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++)
      if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) edge.push([x, y]);
  for (const [x, y] of edge) plot(t, x, y, color, alpha);
  return t;
}

/** Share of pixels that are opaque. */
export function coverage(t) {
  let n = 0;
  for (const c of t.data) if (c >>> 24 > 127) n++;
  return n / t.data.length;
}

/** Mirror a texture left to right. */
export function mirror(t) {
  const out = texture(t.w, t.h);
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) out.data[y * t.w + x] = t.data[y * t.w + (t.w - 1 - x)];
  return out;
}

/** A seeded random source for painting. */
export const random = (seed) => mulberry32(seed);
