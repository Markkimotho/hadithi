import { createPhysics } from "./physics.js";
import { blockedTiles, findPath, spawnFor } from "./layout.js";
import { createInput } from "./input.js";
import { TILE, drawGround, drawPerson, drawProp } from "./art.js";
import { createPuppet, preloadPuppets } from "./puppet.js";
import { runSkillChallenge } from "./skill-challenge.js";

export function exploreScene(Phaser, planck, host) {
  return class ExploreScene extends Phaser.Scene {
    constructor() { super("explore"); }
    preload() {
      this.load.spritesheet("wisdom-tiles", "./art/wisdom/tiles.svg", { frameWidth: 32, frameHeight: 32 });
      preloadPuppets(this);
    }
    create() {
      this.ready = true;
      this.remainder = 0;
      this.facing = { x: 0, y: 1 };
      this.path = [];
      this.motion = host.motion;
      this.inputState = createInput(host.root, host.viewport, {
        interact: () => this.interact(), lift: () => this.lift(), toss: () => this.toss(),
        cancel: () => this.cancelRoute(), paused: host.paused,
      });
      this.input.on("pointerdown", (pointer) => {
        if (host.paused()) return;
        host.viewport.focus({ preventScroll: true });
        const bounds = this.game.canvas.getBoundingClientRect();
        const px = Number.isFinite(pointer.x) ? pointer.x : (pointer.event.clientX - bounds.left) * this.scale.width / bounds.width;
        const py = Number.isFinite(pointer.y) ? pointer.y : (pointer.event.clientY - bounds.top) * this.scale.height / bounds.height;
        const camera = this.cameras.main;
        const player = this.phys.player.getPosition();
        const originX = Number.isFinite(camera.worldView.x) ? camera.worldView.x : player.x * TILE - this.scale.width / (2 * camera.zoom);
        const originY = Number.isFinite(camera.worldView.y) ? camera.worldView.y : player.y * TILE - this.scale.height / (2 * camera.zoom);
        const at = { x: originX + px / camera.zoom, y: originY + py / camera.zoom };
        const { layout } = this.snapshot;
        const x = Math.max(1, Math.min(layout.width - 2, Math.floor(at.x / TILE)));
        const y = Math.max(1, Math.min(layout.height - 2, Math.floor(at.y / TILE)));
        this.navigate([x, y], { nearest: true });
      });
      this.scale.on("resize", this.resizeWorld, this);
      this.events.once("shutdown", () => {
        this.inputState.destroy(); this.cancelRoute();
        this.scale.off("resize", this.resizeWorld, this);
      });
      this.setSnapshot(host.snapshot);
      host.onReady(this);
    }
    setSnapshot(snapshot) {
      if (!this.ready) return;
      const previous = this.snapshot;
      this.snapshot = snapshot;
      this.dispatching = false;
      const { layout, view } = snapshot;
      if (!layout) return;
      const newGround = !previous || previous.ground !== snapshot.ground || previous.tale !== snapshot.tale || previous.view.seed !== view.seed;
      if (newGround) {
        this.cancelRoute();
        this.children.removeAll(true);
        this.phys = createPhysics(planck, layout, spawnFor(layout, previous?.view.scene));
        this.remainder = 0;
        drawGround(this, layout, "wisdom-tiles");
        this.staticProps = layout.props.filter((p) => !p.physics).map((p) => {
          const sprite = drawProp(this, p);
          return sprite.setPosition((p.at[0] + 0.5) * TILE, (p.at[1] + 0.5) * TILE).setDepth((p.at[1] + (p.h ?? 1)) * TILE);
        });
        this.propSprites = this.phys.props.map((p) => ({ prop: p, sprite: drawProp(this, p.source) }));
        this.people = layout.people.map((p) => {
          const sprite = p.kind === "anansi" ? createPuppet(this, "anansi") : drawPerson(this, p.kind);
          return sprite.setPosition((p.at[0] + 0.5) * TILE, (p.at[1] + 0.5) * TILE).setDepth((p.at[1] + 0.5) * TILE);
        });
        this.hero = createPuppet(this, "kweku");
        const p = this.phys.player.getPosition();
        this.hero.setPosition(p.x * TILE, p.y * TILE);
        const camera = this.cameras.main;
        camera.setBounds(0, 0, layout.width * TILE, layout.height * TILE);
        camera.startFollow(this.hero.root, true, this.motion ? 0.12 : 1, this.motion ? 0.12 : 1);
        this.resizeWorld();
        camera.centerOn(this.hero.root.x, this.hero.root.y);
      } else if (previous.view.scene !== view.scene) this.cancelRoute();
      const storm = view.atmosphere.weather === "storm" ? 1.5 + (view.stats.danger ?? 0) * 0.18 : 0;
      this.phys.setWind((layout.wind?.[0] ?? 0) + storm, layout.wind?.[1] ?? 0);
      for (const prop of this.phys.props) {
        if (prop.source.flag) prop.cracked = Boolean(view.flags[prop.source.flag]);
      }
      host.root.dataset.scene = view.scene;
      host.caption.textContent = `${view.kicker} · ${view.objective}`;
      if (previous && previous.view.log.length !== view.log.length) {
        const consequence = view.log.findLast((e) => e.kind !== "action" && e.kind !== "roll");
        if (consequence) host.message.textContent = consequence.text;
      }
      this.renderPlaces();
      this.refreshPrompt();
    }
    resizeWorld() {
      if (!this.phys) return;
      const { layout } = this.snapshot;
      const camera = this.cameras.main;
      // Keep a readable character on phones, with room to look ahead on desktop.
      const zoom = Math.max(0.78, Math.min(1.1, this.scale.width / (22 * TILE)));
      camera.setZoom(zoom);
      camera.setDeadzone(this.scale.width * 0.16, this.scale.height * 0.12);
      camera.setBounds(0, 0, layout.width * TILE, layout.height * TILE);
    }
    places() {
      const { layout, view } = this.snapshot;
      const actionMap = new Map(view.actions.map((a) => [a.id, a]));
      return [
        ...layout.spots.map((sp) => ({ ...sp, actions: sp.actions.map((id) => actionMap.get(id)).filter(Boolean) })),
        ...Object.entries(layout.exits).map(([id, tiles]) => ({ id, at: tiles[Math.floor(tiles.length / 2)], tiles, exit: true, actions: [actionMap.get(id)].filter(Boolean) })),
      ].filter((p) => p.actions.length);
    }
    renderPlaces() {
      host.labels.replaceChildren();
      host.destinations.replaceChildren();
      this.markers = this.places().map((place) => {
        const label = place.name ?? place.actions[0].label;
        const el = document.createElement("button");
        el.className = `world-marker${place.exit ? " world-exit" : ""}`;
        el.textContent = `${place.exit ? "↗" : "◇"} ${label}`;
        el.setAttribute("aria-label", `Walk to: ${label}`);
        el.dataset.place = place.id;
        el.addEventListener("click", () => this.walkTo(place.id));
        host.labels.append(el);
        const link = document.createElement("button");
        link.textContent = label;
        link.dataset.destination = place.id;
        link.addEventListener("click", () => this.walkTo(place.id));
        host.destinations.append(link);
        return { place, el };
      });
    }
    nearby() {
      const pos = this.phys.player.getPosition();
      return this.places().map((place) => ({
        ...place, distance: Math.min(...(place.tiles ?? [place.at]).map(([x, y]) => Math.hypot(pos.x - x - 0.5, pos.y - y - 0.5))),
      })).filter((p) => p.distance < 1.65).sort((a, b) => a.distance - b.distance);
    }
    refreshPrompt() {
      const nearest = this.nearby()[0];
      const carrying = this.phys.carrying;
      const liftable = this.phys.liftable();
      const signature = JSON.stringify([nearest?.id, nearest?.actions.map((a) => [a.id, a.enabled, a.requires]), carrying?.id, liftable?.id]);
      if (signature === this.promptSignature) return;
      this.promptSignature = signature;
      host.prompt.replaceChildren();
      if (nearest) {
        for (const action of nearest.actions) {
          const button = document.createElement("button");
          button.className = "button world-interact";
          button.dataset.worldAction = action.id;
          button.disabled = !action.enabled;
          button.textContent = `${action.label}${action.enabled ? " · E / A" : ` · ${action.requires ?? "Not yet available"}`}`;
          button.addEventListener("click", () => this.interact(action.id));
          host.prompt.append(button);
        }
      } else {
        const p = document.createElement("span");
        p.textContent = "Walk up to something to look, talk or act.";
        host.prompt.append(p);
      }
      host.liftButton.disabled = !carrying && !liftable;
      host.liftButton.textContent = carrying ? "Set down · Q / X" : "Lift · Q / X";
      host.throwButton.disabled = !carrying;
    }
    interact(id) {
      if (this.dispatching || host.paused()) return false;
      const actions = this.nearby().flatMap((p) => p.actions);
      const a = id ? actions.find((a) => a.id === id && a.enabled) : actions.find((a) => a.enabled);
      if (!a) return false;
      this.dispatching = true;
      this.cancelRoute();
      queueMicrotask(async () => {
        if (host.destroyed) return;
        const outcome = a.check?.skill
          ? await runSkillChallenge(host, a.check.skill.kind, host.bridge.profile(a.id))
          : null;
        if (host.destroyed) return;
        if (!outcome && a.check?.skill) this.dispatching = false;
        else host.bridge.action(a.id, outcome);
        host.viewport.focus({ preventScroll: true });
      });
      return true;
    }
    lift() {
      if (host.paused()) return;
      this.cancelRoute();
      if (this.phys.carrying) this.phys.throw(this.facing, 0);
      else this.phys.lift();
      this.refreshPrompt();
      host.viewport.focus({ preventScroll: true });
    }
    toss() {
      if (host.paused()) return;
      this.phys.throw(this.facing);
      this.refreshPrompt();
      host.viewport.focus({ preventScroll: true });
    }
    obstacles() {
      const blocked = blockedTiles(this.snapshot.layout);
      for (const p of this.phys.props) {
        if (p.carried) continue;
        const at = p.body.getPosition();
        blocked.add(`${Math.floor(at.x)},${Math.floor(at.y)}`);
      }
      const [x, y] = this.phys.tile();
      blocked.delete(`${x},${y}`);
      return blocked;
    }
    navigate(goal, { target = null, attempt = false, resolve = null, nearest = false } = {}) {
      this.cancelRoute();
      this.routeGoal = goal;
      const obstacles = this.obstacles();
      let path = findPath(this.snapshot.layout, this.phys.tile(), goal, obstacles);
      if (!path && nearest) {
        const candidates = [];
        for (let radius = 1; radius <= 8; radius++)
          for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++)
            if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) candidates.push([goal[0] + dx, goal[1] + dy]);
        candidates.sort((a, b) => Math.hypot(a[0] - goal[0], a[1] - goal[1]) - Math.hypot(b[0] - goal[0], b[1] - goal[1]));
        for (const candidate of candidates) {
          path = findPath(this.snapshot.layout, this.phys.tile(), candidate, obstacles);
          if (path) { this.routeGoal = candidate; break; }
        }
      }
      if (!path) {
        host.message.textContent = "That way is blocked. Move an object or choose another path.";
        resolve?.(false); return false;
      }
      this.path = path.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
      this.routeTarget = target;
      this.routeAttempt = attempt;
      this.routeResolve = resolve;
      this.stuckTime = 0;
      this.lastDistance = Infinity;
      host.message.textContent = "Walking. Move with the keys or press Escape to stop.";
      return true;
    }
    walkTo(id, attempt = false) {
      const place = this.places().find((p) => p.id === id || p.actions.some((a) => a.id === id));
      if (!place || host.paused()) return Promise.resolve(false);
      host.viewport.focus({ preventScroll: true });
      return new Promise((resolve) => this.navigate(place.at, { target: id, attempt, resolve }));
    }
    cancelRoute() {
      this.path = [];
      this.routeTarget = null;
      this.routeResolve?.(false);
      this.routeResolve = null;
      if (this.phys) this.phys.setIntent(0, 0);
    }
    finishRoute() {
      const target = this.routeTarget, attempt = this.routeAttempt, resolve = this.routeResolve;
      this.routeResolve = null;
      this.path = [];
      this.routeTarget = null;
      host.message.textContent = "Arrived. Choose an action below, or press E / A.";
      const actionId = this.places().find((p) => p.id === target)?.actions.find((a) => a.enabled)?.id ?? target;
      resolve?.(attempt ? this.interact(actionId) : true);
    }
    update(time, delta) {
      if (!this.phys || host.destroyed) return;
      const intent = this.inputState.read();
      const paused = host.paused() || host.skillActive || !intent.active;
      const p = this.phys.player.getPosition();
      let { x, y, run } = intent;
      if (paused || !intent.active) { x = 0; y = 0; }
      if (!paused && intent.active && this.path.length) {
        if (x || y) this.cancelRoute();
        else {
          const next = this.path[0];
          const distance = Math.hypot(next.x - p.x, next.y - p.y);
          if (distance < 0.14) {
            this.path.shift(); this.lastDistance = Infinity; this.stuckTime = 0;
            if (!this.path.length) this.finishRoute();
          } else {
            x = (next.x - p.x) / distance; y = (next.y - p.y) / distance;
            // Slow near a waypoint to avoid overshooting at low frame rates.
            const speed = Math.min(1, distance / 0.4); x *= speed; y *= speed;
            this.stuckTime = distance >= this.lastDistance - 0.005 ? this.stuckTime + delta : 0;
            this.lastDistance = distance;
            if (this.stuckTime > 700) {
              const target = this.routeTarget, attempt = this.routeAttempt, resolve = this.routeResolve;
              this.routeResolve = null;
              this.navigate(this.routeGoal, { target, attempt, resolve });
            }
          }
        }
      }
      if (x || y) {
        const length = Math.hypot(x, y);
        this.facing = { x: x / length, y: y / length };
      }
      this.phys.setIntent(x, y, run);
      if (!paused) this.remainder = this.phys.advance(delta / 1000, this.remainder);
      const at = this.phys.player.getPosition();
      this.hero.setPosition(at.x * TILE, at.y * TILE).setDepth(at.y * TILE + 2);
      const carrying = Boolean(this.phys.carrying);
      this.hero.play(carrying ? "carry" : (x || y) ? "walk" : "idle", time);
      this.hero.setScale(this.facing.x < -0.08 ? -1 : 1, 1);
      for (const { prop, sprite } of this.propSprites) {
        const p = prop.body.getPosition();
        sprite.setPosition(p.x * TILE, p.y * TILE - prop.z * 17).setDepth(p.y * TILE + (prop.carried ? 4 : 0));
        sprite.setRotation(prop.carried ? 0 : prop.body.getAngle());
        sprite.setAlpha(prop.cracked ? 0.65 : 1);
      }
      const camera = this.cameras.main;
      for (const { place, el } of this.markers) {
        const left = ((place.at[0] + 0.5) * TILE - camera.worldView.x) * camera.zoom;
        const top = ((place.at[1] + 0.5) * TILE - camera.worldView.y) * camera.zoom - 34;
        el.style.left = `${Math.max(el.offsetWidth / 2 + 4, Math.min(this.scale.width - el.offsetWidth / 2 - 4, left))}px`;
        el.style.top = `${Math.max(el.offsetHeight + 6, top)}px`;
        el.hidden = left < 0 || left > this.scale.width || top < -30 || top > this.scale.height - 30;
      }
      // Dispatch only after stepping physics, never from inside a contact callback.
      const events = this.phys.events.splice(0);
      for (const e of events) if (e.type === "crack") {
        host.message.textContent = `The ${e.prop.kind} cracked.`;
        if (e.prop.source.flag) queueMicrotask(() => { if (!host.destroyed) host.bridge.crack(e.prop); });
      }
      this.refreshPrompt();
      if (!paused && intent.active && !this.dispatching) {
        const tile = this.phys.tile();
        const exit = this.places().find((p) => p.exit && (!this.routeTarget || p.id === this.routeTarget) && p.actions[0].enabled && p.tiles.some(([x, y]) => tile[0] === x && tile[1] === y));
        if (exit) {
          const resolve = this.routeResolve; this.routeResolve = null;
          const acted = this.interact(exit.actions[0].id);
          resolve?.(acted);
        }
      }
    }
    inspect() {
      const p = this.phys.player.getPosition();
      return {
        scene: this.snapshot.view.scene, position: { x: p.x, y: p.y },
        walking: this.path.length > 0,
        camera: { x: this.cameras.main.worldView.x, y: this.cameras.main.worldView.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY, width: this.cameras.main.width, height: this.cameras.main.height, zoom: this.cameras.main.zoom },
        art: {
          tiles: this.textures.exists("wisdom-tiles") ? this.textures.get("wisdom-tiles").frameTotal : 0,
          kweku: this.textures.exists("puppet-kweku-head") ? 1 : 0,
        },
        props: this.phys.props.map((prop) => ({ id: prop.id, x: prop.body.getPosition().x, y: prop.body.getPosition().y, cracked: prop.cracked, carried: prop.carried })),
      };
    }
  };
}
