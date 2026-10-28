// The title screen's living backdrop: each tale's opening place, drawn by the
// same renderer as the game, the camera turning slowly where the hero first
// stands. Cards get a still frame of their tale.
import { layoutsFor } from "../world/layouts/index.js";
import { buildLevel, worldArtFor } from "../world/ray/scene.js";
import { createTarget, prepareLevel, renderFrame, vignette } from "../world/ray/render.js";
import { camera, lightFor } from "../world/ray/cast.js";
import { sceneThings, sceneLights, facingFrom } from "../world/ray/things.js";
import { spawnFor } from "../world/layout.js";
import { eyeOf } from "../world/tales.js";

const scenes = new Map();

/** Everything needed to draw a tale's opening scene, painted once. */
function sceneFor(episode) {
  if (scenes.has(episode.id)) return scenes.get(episode.id);
  const layouts = layoutsFor(episode.id);
  const layout = layouts[episode.start];
  const art = worldArtFor(episode.id, [layout]);
  const level = buildLevel(layout);
  const light = lightFor(episode.scenes[episode.start]?.light ?? "day");
  const spawn = spawnFor(layout, null);
  const scene = {
    layout,
    level,
    prepared: prepareLevel(level, art),
    things: sceneThings(level, layout, art),
    lights: sceneLights(level, layout, light),
    light,
    at: [spawn[0] + 0.5, spawn[1] + 0.5],
    angle: facingFrom(layout, spawn),
    eye: eyeOf(episode.id),
  };
  scenes.set(episode.id, scene);
  return scene;
}

function paint(canvas, target, scene, angle, time) {
  const cam = camera(scene.at[0], scene.at[1], angle, target.w / target.h);
  renderFrame(target, scene.prepared, cam, { light: scene.light, time, eye: scene.eye, things: scene.things, lights: scene.lights });
  vignette(target, 0.6);
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(target.data.buffer), target.w, target.h), 0, 0);
}

/** A still frame of a tale's opening, for its card. */
export function paintThumb(canvas, episode) {
  const target = createTarget(160, 90);
  canvas.width = 160;
  canvas.height = 90;
  const scene = sceneFor(episode);
  paint(canvas, target, scene, scene.angle, 0);
}

/**
 * The turning backdrop. Returns { show(episode), destroy() }.
 * With motion off the camera holds still.
 */
export function mountTitleView(canvas, motion) {
  let scene = null,
    raf = 0,
    start = performance.now(),
    last = 0;
  const target = createTarget(320, 180);
  canvas.width = 320;
  canvas.height = 180;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (!scene || now - last < 33) return;
    last = now;
    const t = (now - start) / 1000;
    paint(canvas, target, scene, scene.angle + Math.sin(t * 0.08) * 1.2, t);
  };
  return {
    show(episode) {
      try {
        scene = sceneFor(episode);
      } catch {
        scene = null;
      }
      start = performance.now();
      if (scene && !motion) paint(canvas, target, scene, scene.angle, 0);
      else if (scene && !raf) raf = requestAnimationFrame(loop);
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
