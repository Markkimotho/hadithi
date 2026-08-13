import { exploreScene } from "./ExploreScene.js";
import { mountWeather } from "../ui/atmosphere.js";

export function createWorld({ bridge, paused, motion, onError }) {
  const root = document.createElement("section");
  root.className = "world-stage";
  root.setAttribute("aria-label", "Explore the scene");
  root.innerHTML = `<p class="world-caption"></p><div class="world-viewport" tabindex="0" role="group" aria-label="Walk through the scene" aria-describedby="world-help">
    <div class="world-canvas"></div><div class="world-light-layer" aria-hidden="true"></div><canvas class="weather-layer world-weather" aria-hidden="true"></canvas><div class="world-labels"></div>
    <p class="world-loading" role="status">Opening the world…</p>
    </div><div class="world-controls"><div class="world-joystick" role="group" aria-label="Touch movement joystick"><span aria-hidden="true">✥</span></div>
    <div class="world-prompt" aria-live="polite"></div><div class="world-carry"><button data-lift disabled>Lift · Q / X</button><button data-throw disabled>Throw · F / Y</button></div></div>
    <p id="world-help" class="world-help">WASD / arrows or left stick to walk. Shift / B to run. Tap the ground to walk there. E / A to act.</p>
    <p class="world-message" role="status">Walking and moving objects take no turns.</p>
    <details class="world-places"><summary>Places in this area</summary><div class="world-destinations"></div></details>`;
  const host = {
    root, viewport: root.querySelector(".world-viewport"), labels: root.querySelector(".world-labels"),
    destinations: root.querySelector(".world-destinations"), prompt: root.querySelector(".world-prompt"),
    message: root.querySelector(".world-message"), caption: root.querySelector(".world-caption"), liftButton: root.querySelector("[data-lift]"),
    throwButton: root.querySelector("[data-throw]"), bridge, paused, motion,
    snapshot: bridge.read(), destroyed: false,
    onReady(scene) {
      host.scene = scene;
      root.querySelector(".world-loading").remove();
      root.dataset.ready = "true";
    },
  };
  const weatherLayer = root.querySelector(".world-weather");
  let renderer, observer;
  host.liftButton.onclick = () => host.scene?.lift();
  host.throwButton.onclick = () => host.scene?.toss();
  // Vendor code is fetched only when a mapped story is entered in world view.
  Promise.all([import("../vendor/phaser.esm.min.js"), import("../vendor/planck.mjs")]).then(([module, planck]) => {
    if (host.destroyed) return;
    const Phaser = module.default ?? module;
    const container = root.querySelector(".world-canvas");
    renderer = new Phaser.Game({
      type: Phaser.AUTO, parent: container,
      width: host.viewport.clientWidth || 700, height: host.viewport.clientHeight || 480,
      backgroundColor: "#596747", banner: false, audio: { noAudio: true },
      input: { keyboard: false, mouse: { preventDefaultWheel: false }, touch: { capture: false } },
      render: { antialias: true },
      scene: exploreScene(Phaser, planck, host),
      callbacks: { postBoot(game) { game.canvas.setAttribute("aria-hidden", "true"); } },
    });
    observer = new ResizeObserver(() => {
      if (host.viewport.clientWidth && host.viewport.clientHeight) renderer.scale.resize(host.viewport.clientWidth, host.viewport.clientHeight);
    });
    observer.observe(host.viewport);
  }).catch((error) => { if (!host.destroyed) onError(error); });
  return {
    root,
    sync(nextMotion) {
      host.snapshot = bridge.read();
      host.motion = nextMotion;
      const atmosphere = host.snapshot?.view.atmosphere ?? { weather: "none", light: "day" };
      root.dataset.weather = atmosphere.weather;
      root.dataset.light = atmosphere.light;
      mountWeather(weatherLayer, atmosphere.weather, nextMotion);
      if (host.scene) {
        host.scene.motion = nextMotion;
        host.scene.cameras.main.setLerp(nextMotion ? 0.12 : 1, nextMotion ? 0.12 : 1);
        host.scene.setSnapshot(host.snapshot);
      }
    },
    walkTo(id) { return host.scene?.walkTo(id, true) ?? Promise.resolve(false); },
    inspect() { return host.scene?.inspect() ?? null; },
    weatherLayer,
    destroy() {
      host.destroyed = true; observer?.disconnect();
      host.scene?.inputState.destroy(); host.scene?.cancelRoute();
      renderer?.destroy(true); root.remove();
    },
  };
}
