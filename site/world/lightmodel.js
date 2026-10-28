// The light of a scene: the time of day from the story, changed by its weather.
import { lightFor } from "./ray/cast.js";

/** Weather changes the light: storms darken, mist thickens the fog. */
export function lightModel(atmosphere) {
  const base = lightFor(atmosphere.light);
  const m = { ...base, fog: [...base.fog], tint: [...base.tint] };
  if (atmosphere.weather === "storm" || atmosphere.weather === "rain") {
    m.day *= 0.62;
    m.density += 0.03;
    m.fog = m.fog.map((c) => c * 0.7);
    m.torch = Math.max(m.torch, 0.25);
  }
  if (atmosphere.weather === "mist") {
    m.density *= 1.7;
    m.fog = m.fog.map((c) => c * 0.85 + 18);
  }
  if (atmosphere.weather === "dust") {
    m.density *= 1.8;
    m.fog = [m.fog[0] * 0.8 + 40, m.fog[1] * 0.8 + 28, m.fog[2] * 0.8 + 10];
  }
  // In weather the sky closes in toward the fog.
  const close = { storm: 0.55, rain: 0.45, mist: 0.6, dust: 0.5 }[atmosphere.weather] ?? 0;
  if (close) m.sky = m.sky.map((c) => c.map((v, i) => v + (m.fog[i] - v) * close));
  return m;
}
