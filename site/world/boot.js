// Mounts the playable world into the play shell. The world owns a canvas and
// its light and weather layers; every word on screen belongs to the shell.
import { exploreScene } from "./ExploreScene.js";
import { mountWeather } from "../ui/atmosphere.js";

/**
 * @param bridge   story boundary (see bridge.js)
 * @param root     the play shell element (the joystick lives inside it)
 * @param paused   () => true while a dialog, the journal or a page covers play
 * @param busy     () => true while the story is being told or a trial runs
 * @param events   callbacks: onPlaces, onNear, onConverse, onAdvance, onMessage, onMove, onFrame, onImpact
 */
export function createWorld({ bridge, root, paused, busy, events, motion, onError }) {
  const stage = document.createElement("div");
  stage.className = "world-stage";
  stage.innerHTML = `<div class="world-canvas"></div><div class="world-light-layer" aria-hidden="true"></div><canvas class="weather-layer world-weather" aria-hidden="true"></canvas><p class="world-loading" role="status">The storyteller clears their throat…</p>`;
  const host = {
    root: stage,
    controls: root,
    bridge,
    paused,
    busy,
    events,
    motion,
    snapshot: bridge.read(),
    destroyed: false,
    onReady(scene) {
      host.scene = scene;
      stage.querySelector(".world-loading")?.remove();
      stage.dataset.ready = "true";
      events.onReady?.();
    },
  };
  const weatherLayer = stage.querySelector(".world-weather");
  let renderer, observer;
  // Vendor code is fetched only when a tale is entered.
  Promise.all([import("../vendor/phaser.esm.min.js"), import("../vendor/planck.mjs")])
    .then(([module, planck]) => {
      if (host.destroyed) return;
      const Phaser = module.default ?? module;
      renderer = new Phaser.Game({
        type: Phaser.AUTO,
        parent: stage.querySelector(".world-canvas"),
        width: stage.clientWidth || 800,
        height: stage.clientHeight || 600,
        backgroundColor: "#2a3122",
        banner: false,
        audio: { noAudio: true },
        input: { keyboard: false, mouse: { preventDefaultWheel: false }, touch: { capture: false } },
        render: { antialias: true },
        scene: exploreScene(Phaser, planck, host),
        callbacks: { postBoot(game) { game.canvas.setAttribute("aria-hidden", "true"); } },
      });
      observer = new ResizeObserver(() => {
        if (stage.clientWidth && stage.clientHeight) renderer.scale.resize(stage.clientWidth, stage.clientHeight);
      });
      observer.observe(stage);
    })
    .catch((error) => {
      if (!host.destroyed) onError(error);
    });
  return {
    root: stage,
    sync(nextMotion) {
      host.snapshot = bridge.read();
      host.motion = nextMotion;
      const atmosphere = host.snapshot?.view.atmosphere ?? { weather: "none", light: "day" };
      stage.dataset.weather = atmosphere.weather;
      stage.dataset.light = atmosphere.light;
      mountWeather(weatherLayer, atmosphere.weather, nextMotion);
      if (host.scene) {
        host.scene.motion = nextMotion;
        host.scene.cameras.main.setLerp(nextMotion ? 0.1 : 1, nextMotion ? 0.1 : 1);
        host.scene.setSnapshot(host.snapshot);
      }
    },
    get ready() { return Boolean(host.scene); },
    walkTo(id, attempt = true) { return host.scene?.walkTo(id, attempt) ?? Promise.resolve(false); },
    interact(id) { return host.scene?.interact(id) ?? false; },
    lift() { host.scene?.lift(); },
    toss() { host.scene?.toss(); },
    release() { if (host.scene) host.scene.dispatching = false; },
    project(at, lift) { return host.scene?.project(at, lift) ?? null; },
    heroScreen() { return host.scene?.heroScreen() ?? null; },
    flyToBag(itemId, target) { host.scene?.flyToBag(itemId, target); },
    inspect() { return host.scene?.inspect() ?? null; },
    placed(id) { return host.scene?.placed(id) ?? false; },
    destroy() {
      host.destroyed = true;
      observer?.disconnect();
      host.scene?.inputState.destroy();
      host.scene?.cancelRoute();
      renderer?.destroy(true);
      stage.remove();
    },
  };
}
