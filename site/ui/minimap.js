// The minimap in the corner of the HUD: the ground plan seen from above,
// north up, with what you can do marked and an arrow for where you look.
// The ground is drawn once per scene and kept; only the marks move.

const SIZE = 132;
const GROUND = {
  ".": "#7a5236", ",": "#4f6a34", '"': "#5c7a3c", ":": "#9a7450", _: "#c2a274", "~": "#4f8a92", w: "#2c5866",
  "+": "#8a6440", s: "#7c776c", r: "#8a3a2c", m: "#4e3a2a", "#": "#1c1814", "=": "#5a4028", o: "#5e5a52",
  T: "#24361e", b: "#2e4626", h: "#2a1e18", " ": "#0e0c0a",
};
const cache = new WeakMap();

/** Paint the ground of a layout into an offscreen canvas, one block per tile. */
function ground(layout, level, scale) {
  const known = cache.get(layout);
  if (known && known.scale === scale) return known.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(layout.width * scale);
  canvas.height = Math.ceil(layout.height * scale);
  const c = canvas.getContext("2d");
  for (let y = 0; y < layout.height; y++)
    for (let x = 0; x < layout.width; x++) {
      const wall = level.walls[y * layout.width + x];
      c.fillStyle = wall && !GROUND[wall] ? "#2a1e18" : GROUND[layout.grid[y][x]] ?? "#333";
      c.fillRect(Math.floor(x * scale), Math.floor(y * scale), Math.ceil(scale), Math.ceil(scale));
    }
  cache.set(layout, { scale, canvas });
  return canvas;
}

/**
 * @param canvas the HUD canvas
 * @param state  { layout, level, x, y, angle, places, followers } from world.mapState()
 */
export function drawMinimap(canvas, state) {
  if (canvas.width !== SIZE) {
    canvas.width = SIZE;
    canvas.height = SIZE;
  }
  const { layout } = state;
  const scale = Math.min(SIZE / layout.width, SIZE / layout.height);
  const ox = Math.floor((SIZE - layout.width * scale) / 2),
    oy = Math.floor((SIZE - layout.height * scale) / 2);
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.fillStyle = "#0e0c0a";
  c.fillRect(0, 0, SIZE, SIZE);
  c.drawImage(ground(layout, state.level, scale), ox, oy);
  const at = (x, y) => [ox + x * scale, oy + y * scale];
  // Roads out: pale blocks on their tiles.
  for (const place of state.places) {
    if (!place.exit) continue;
    c.fillStyle = place.actions[0]?.enabled ? "#efe4c6" : "#7a7060";
    for (const [x, y] of place.tiles) {
      const [px, py] = at(x, y);
      c.fillRect(px, py, Math.max(2, scale), Math.max(2, scale));
    }
  }
  // Things to do: gold, or blue if remembered, dim if not yet open.
  for (const place of state.places) {
    if (place.exit) continue;
    const enabled = place.actions.some((a) => a.enabled);
    c.fillStyle = place.actions.some((a) => a.remembered) ? "#9fc0c8" : enabled ? "#f3dc9a" : "#6a6050";
    const [px, py] = at(place.at[0] + 0.5, place.at[1] + 0.5);
    c.fillRect(Math.round(px - 2), Math.round(py - 2), 4, 4);
  }
  for (const f of state.followers ?? []) {
    const [px, py] = at(f.x, f.y);
    c.fillStyle = "#d8b07a";
    c.fillRect(Math.round(px - 1.5), Math.round(py - 1.5), 3, 3);
  }
  // You: a view cone and an arrow.
  const [px, py] = at(state.x, state.y);
  c.save();
  c.translate(px, py);
  c.rotate(state.angle);
  c.fillStyle = "#f3dc9a33";
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, scale * 4, -0.58, 0.58);
  c.closePath();
  c.fill();
  c.fillStyle = "#fff4d6";
  c.strokeStyle = "#1c1814";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(6, 0);
  c.lineTo(-4, -4);
  c.lineTo(-2, 0);
  c.lineTo(-4, 4);
  c.closePath();
  c.stroke();
  c.fill();
  c.restore();
}
