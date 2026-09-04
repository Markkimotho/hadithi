// The walkable scene. It owns physics, the hero, props, people and the camera.
// It never writes story state: it reports where things are to the play shell
// (host.events) and asks for story actions through host.bridge.
import { createPhysics } from "./physics.js";
import { blockedTiles, findPath, spawnFor, walkable } from "./layout.js";
import { createInput } from "./input.js";
import { TILE, drawGround, drawPerson, drawProp } from "./art.js";
import { createPuppet, preloadPuppets } from "./puppet.js";
import { playTrial } from "./trials/stage.js";

const GESTURE = {
  INSPECT: "kneel",
  USE_ITEM: "kneel",
  TAKE_ITEM: "reach",
  TALK: "talk",
  BARGAIN: "talk",
  CHOOSE: "talk",
  SOLVE: "reach",
  WAIT: "kneel",
};

export function exploreScene(Phaser, planck, host) {
  return class ExploreScene extends Phaser.Scene {
    constructor() {
      super("explore");
    }
    preload() {
      this.load.spritesheet("wisdom-tiles", "./art/wisdom/tiles.svg", { frameWidth: 32, frameHeight: 32 });
      preloadPuppets(this);
    }
    create() {
      this.ready = true;
      this.planck = planck;
      this.remainder = 0;
      this.facing = { x: 0, y: 1 };
      this.path = [];
      this.motion = host.motion;
      this.inputState = createInput(host.controls, {
        interact: () => this.interact(),
        lift: () => this.lift(),
        toss: () => this.toss(),
        cancel: () => this.cancelRoute(),
        paused: host.paused,
      });
      this.input.on("pointerdown", (pointer) => {
        if (host.paused() || host.busy()) return;
        const camera = this.cameras.main;
        const world = camera.getWorldPoint(pointer.x, pointer.y);
        const { layout } = this.snapshot;
        const x = Math.max(0, Math.min(layout.width - 1, Math.floor(world.x / TILE)));
        const y = Math.max(0, Math.min(layout.height - 1, Math.floor(world.y / TILE)));
        // Tapping a place walks there and acts; tapping ground just walks.
        const place = this.places().find((p) => (p.tiles ?? [p.at]).some(([px, py]) => Math.abs(px - x) <= 0 && Math.abs(py - y) <= 0));
        if (place) this.walkTo(place.id, true);
        else this.navigate([x, y], { nearest: true });
      });
      this.scale.on("resize", this.resizeWorld, this);
      this.events.once("shutdown", () => {
        this.inputState.destroy();
        this.cancelRoute();
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
      const newGround =
        !previous || previous.ground !== snapshot.ground || previous.tale !== snapshot.tale || previous.view.seed !== view.seed;
      if (newGround) this.buildGround(layout, previous?.view.scene);
      else if (previous.view.scene !== view.scene) this.cancelRoute();
      const storm = view.atmosphere.weather === "storm" ? 1.5 + (view.stats.danger ?? 0) * 0.18 : 0;
      this.phys.setWind((layout.wind?.[0] ?? 0) - storm, layout.wind?.[1] ?? 0);
      for (const prop of this.phys.props) if (prop.source.flag) prop.cracked = Boolean(view.flags[prop.source.flag]);
      // Some people are only there once the story has brought them.
      for (const person of this.people ?? []) if (person.source.when) (person.sprite.root ?? person.sprite).setVisible(Boolean(view.flags[person.source.when]));
      this.syncTaken(view);
      this.buildGlints();
      host.root.dataset.scene = view.scene;
      host.events.onPlaces(this.places());
      this.promptSignature = null;
      this.refreshPrompt();
    }

    buildGround(layout, from) {
      this.cancelRoute();
      this.children.removeAll(true);
      this.tweens.killAll();
      this.phys = createPhysics(planck, layout, spawnFor(layout, from));
      this.remainder = 0;
      drawGround(this, layout, "wisdom-tiles");
      this.staticProps = layout.props
        .filter((p) => !p.physics)
        .map((p) => ({
          source: p,
          sprite: drawProp(this, p)
            .setPosition((p.at[0] + 0.5) * TILE, (p.at[1] + 0.5) * TILE)
            .setDepth((p.at[1] + (p.h ?? 1)) * TILE),
        }));
      this.propSprites = this.phys.props.map((p) => ({ prop: p, sprite: drawProp(this, p.source) }));
      this.people = layout.people.map((p) => this.addPerson(p, layout));
      this.hero = createPuppet(this, "kweku");
      const at = this.phys.player.getPosition();
      this.hero.setPosition(at.x * TILE, at.y * TILE);
      const camera = this.cameras.main;
      camera.setBounds(0, 0, layout.width * TILE, layout.height * TILE);
      camera.startFollow(this.hero.root, true, this.motion ? 0.1 : 1, this.motion ? 0.1 : 1);
      this.resizeWorld();
      camera.centerOn(this.hero.root.x, this.hero.root.y);
      if (this.motion) camera.fadeIn(450, 20, 24, 18);
    }

    /** People stand, work, or wander; animals peck about. */
    addPerson(p, layout) {
      const sprite = p.kind === "anansi" ? createPuppet(this, "anansi") : drawPerson(this, p.kind, { tint: p.tint, id: p.id });
      const x = (p.at[0] + 0.5) * TILE,
        // A perched person (Anansi up the trunk) is drawn above their tile.
        y = (p.at[1] + 0.5) * TILE - (p.perch ?? 0) * TILE;
      sprite.setPosition(x, y).setDepth(p.perch ? 9000 + y : y);
      const person = { source: p, sprite, home: [...p.at] };
      if (this.motion) {
        const target = sprite.root ?? sprite;
        if (p.wander) this.time.addEvent({ delay: 1600 + Math.random() * 1800, loop: true, callback: () => this.wander(person, layout) });
        else this.tweens.add({ targets: target, scaleY: 1.03, duration: 1300 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
      return person;
    }

    wander(person, layout) {
      if (!this.sys.isActive() || host.paused()) return;
      const r = person.source.wander;
      const [hx, hy] = person.home;
      for (let i = 0; i < 6; i++) {
        const tx = hx + Math.round((Math.random() * 2 - 1) * r),
          ty = hy + Math.round((Math.random() * 2 - 1) * r);
        if (!walkable(layout, tx, ty)) continue;
        const target = person.sprite.root ?? person.sprite;
        const nx = (tx + 0.5) * TILE,
          ny = (ty + 0.5) * TILE;
        if (target.x !== nx) target.setScale(nx < target.x ? -1 : 1, 1);
        this.tweens.add({
          targets: target,
          x: nx,
          y: ny,
          duration: 500 + Math.hypot(nx - target.x, ny - target.y) * 9,
          ease: "Sine.inOut",
          onUpdate: () => target.setDepth(target.y),
        });
        return;
      }
    }

    /** Things already in the bag are no longer lying in the world. */
    syncTaken(view) {
      const gone = (p) => (p.item ?? p.kind) && view.taken.includes(p.item ?? p.kind);
      for (const { source, sprite } of this.staticProps) sprite.setVisible(!gone(source));
      for (const { prop, sprite } of this.propSprites) {
        const hidden = gone(prop.source);
        sprite.setVisible(!hidden);
        if (hidden && prop.body.isActive()) prop.body.setActive(false);
      }
    }

    /** A soft glint marks everything you can look at, take, or talk to. */
    buildGlints() {
      for (const g of this.glints ?? []) g.destroy();
      this.glints = [];
      for (const place of this.places()) {
        if (place.exit) continue;
        const enabled = place.actions.some((a) => a.enabled);
        const remembered = place.actions.some((a) => a.remembered);
        const [x, y] = place.at;
        const glint = this.add.graphics().setDepth((y + 1) * TILE + 1);
        const color = remembered ? 0x9fc0c8 : 0xf3dc9a;
        glint.lineStyle(2, color, enabled ? 0.9 : 0.35).strokeCircle(0, 0, 9);
        glint.fillStyle(color, enabled ? 0.85 : 0.3).fillCircle(0, 0, 3);
        glint.setPosition((x + 0.5) * TILE, (y + 0.5) * TILE - 18);
        if (this.motion && enabled) this.tweens.add({ targets: glint, y: glint.y - 5, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        this.glints.push(glint);
      }
    }

    resizeWorld() {
      if (!this.phys) return;
      const { layout } = this.snapshot;
      const camera = this.cameras.main;
      // A readable hero on phones; room to look around on a desktop.
      const zoom = Math.max(0.85, Math.min(1.45, Math.min(this.scale.width / (18 * TILE), this.scale.height / (11 * TILE))));
      camera.setZoom(zoom);
      camera.setDeadzone(this.scale.width * 0.12, this.scale.height * 0.1);
      camera.setBounds(0, 0, layout.width * TILE, layout.height * TILE);
    }

    places() {
      const { layout, view } = this.snapshot;
      if (!layout) return [];
      const actionMap = new Map(view.actions.map((a) => [a.id, a]));
      return [
        ...layout.spots.map((sp) => ({ ...sp, actions: sp.actions.map((id) => actionMap.get(id)).filter(Boolean) })),
        ...Object.entries(layout.exits).map(([id, tiles]) => ({
          id,
          at: tiles[Math.floor(tiles.length / 2)],
          tiles,
          exit: true,
          name: null,
          actions: [actionMap.get(id)].filter(Boolean),
        })),
      ].filter((p) => p.actions.length);
    }

    nearby() {
      const pos = this.phys.player.getPosition();
      return this.places()
        .map((place) => ({
          ...place,
          distance: Math.min(...(place.tiles ?? [place.at]).map(([x, y]) => Math.hypot(pos.x - x - 0.5, pos.y - y - 0.5))),
        }))
        .filter((p) => p.distance < 1.7 && !p.exit)
        .sort((a, b) => a.distance - b.distance);
    }

    refreshPrompt() {
      if (!this.phys) return;
      const place = this.nearby()[0] ?? null;
      const carrying = this.phys.carrying;
      const liftable = this.phys.liftable();
      const signature = JSON.stringify([place?.id, place?.actions.map((a) => [a.id, a.enabled, a.requires]), carrying?.id, liftable?.id]);
      if (signature === this.promptSignature) return;
      this.promptSignature = signature;
      host.events.onNear({ place, carrying: carrying?.kind ?? null, liftable: liftable?.kind ?? null });
    }

    /**
     * Act at the nearest place. A place with several things to do (a person
     * to talk to) opens a conversation in the story band instead.
     */
    interact(id) {
      // During a trial, the act key is the trial's press.
      if (this.trialPress && !id) {
        this.trialPress();
        return true;
      }
      if (this.dispatching || host.paused() || host.busy()) return false;
      if (!id && host.events.onAdvance?.()) return true;
      const place = id ? this.places().find((p) => p.actions.some((a) => a.id === id)) : this.nearby()[0];
      if (!place) return false;
      const enabled = place.actions.filter((a) => a.enabled);
      if (!id && enabled.length > 1) {
        host.events.onConverse(place);
        return true;
      }
      const a = id ? place.actions.find((x) => x.id === id && x.enabled) : enabled[0];
      if (!a) return false;
      this.dispatching = true;
      this.cancelRoute();
      this.perform(a, place).then(() => {
        if (host.destroyed) return;
        host.bridge.request(a, place);
      });
      return true;
    }

    /** Turn to the place and act it out before the story answers. */
    perform(action, place) {
      const gesture = GESTURE[action.type];
      const root = this.hero.root;
      if (place) {
        const p = this.phys.player.getPosition();
        const dx = place.at[0] + 0.5 - p.x;
        if (Math.abs(dx) > 0.1) this.facing = { x: Math.sign(dx), y: 0 };
        this.hero.setScale(this.facing.x < -0.08 ? -1 : 1, 1);
      }
      if (!gesture || !this.motion) return Promise.resolve();
      const sx = root.scaleX;
      return new Promise((resolve) => {
        const done = () => {
          root.setScale(sx, 1);
          resolve();
        };
        if (gesture === "kneel")
          this.tweens.add({ targets: root, scaleY: 0.82, scaleX: sx * 1.08, duration: 220, yoyo: true, hold: 260, ease: "Quad.out", onComplete: done });
        else if (gesture === "reach")
          this.tweens.add({ targets: root, x: root.x + this.facing.x * 6, y: root.y + this.facing.y * 6 - 3, duration: 160, yoyo: true, hold: 120, ease: "Quad.out", onComplete: done });
        else this.tweens.add({ targets: root, y: root.y - 4, duration: 120, yoyo: true, repeat: 1, ease: "Sine.inOut", onComplete: done });
      });
    }

    /** The thing just taken lifts off the ground and flies toward the bag. */
    flyToBag(itemId, screenTarget) {
      const entry = [...(this.staticProps ?? []), ...(this.propSprites ?? [])].find(({ source, prop }) => ((source ?? prop.source).item ?? (source ?? prop.source).kind) === itemId);
      const camera = this.cameras.main;
      const from = entry ? { x: entry.sprite.x, y: entry.sprite.y } : { x: this.hero.root.x, y: this.hero.root.y - 30 };
      const token = this.add.graphics().setDepth(99999).setScrollFactor(0);
      token.fillStyle(0xf3dc9a, 1).fillCircle(0, 0, 7);
      token.lineStyle(2, 0x3a2a1c, 1).strokeCircle(0, 0, 7);
      const start = { x: (from.x - camera.worldView.x) * camera.zoom, y: (from.y - camera.worldView.y) * camera.zoom };
      token.setPosition(start.x, start.y);
      entry?.sprite.setVisible(false);
      if (!this.motion) return token.destroy();
      this.tweens.add({
        targets: token,
        x: screenTarget.x,
        y: screenTarget.y,
        scale: 0.6,
        duration: 650,
        ease: "Cubic.in",
        onComplete: () => token.destroy(),
      });
    }

    lift() {
      if (host.paused() || host.busy()) return;
      this.cancelRoute();
      if (this.phys.carrying) this.phys.throw(this.facing, 0);
      else this.phys.lift();
      this.refreshPrompt();
    }
    toss() {
      if (host.paused() || host.busy()) return;
      this.phys.throw(this.facing);
      this.refreshPrompt();
    }

    obstacles() {
      const blocked = blockedTiles(this.snapshot.layout);
      for (const p of this.phys.props) {
        if (p.carried || !p.body.isActive()) continue;
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
          for (let dy = -radius; dy <= radius; dy++)
            for (let dx = -radius; dx <= radius; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) candidates.push([goal[0] + dx, goal[1] + dy]);
        for (const candidate of candidates) {
          path = findPath(this.snapshot.layout, this.phys.tile(), candidate, obstacles);
          if (path) {
            this.routeGoal = candidate;
            break;
          }
        }
      }
      if (!path) {
        host.events.onMessage("Something is in the way. Move it, or go round.");
        resolve?.(false);
        return false;
      }
      this.path = path.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
      // Long walks break into a run, the way anyone hurries across a yard.
      this.routeRun = path.length > 6;
      this.routeRetries = this.routeTarget === target && this.routeGoal ? this.routeRetries ?? 0 : 0;
      this.routeTarget = target;
      this.routeAttempt = attempt;
      this.routeResolve = resolve;
      this.stuckTime = 0;
      this.lastDistance = Infinity;
      return true;
    }

    walkTo(id, attempt = false) {
      const place = this.places().find((p) => p.id === id || p.actions.some((a) => a.id === id));
      if (!place || host.paused()) return Promise.resolve(false);
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
      const target = this.routeTarget,
        attempt = this.routeAttempt,
        resolve = this.routeResolve;
      this.routeResolve = null;
      this.path = [];
      this.routeTarget = null;
      if (!attempt) return resolve?.(true);
      const place = this.places().find((p) => p.id === target || p.actions.some((a) => a.id === target));
      if (place?.exit) return resolve?.(true); // the exit fires on its own when you step on it
      const direct = place?.actions.find((a) => a.id === target && a.enabled);
      resolve?.(direct ? this.interact(direct.id) : this.interact());
    }

    update(time, delta) {
      if (!this.phys || host.destroyed) return;
      const intent = this.inputState.read();
      const paused = host.paused() || host.busy();
      const p = this.phys.player.getPosition();
      let { x, y, run } = intent;
      if (paused) {
        x = 0;
        y = 0;
      }
      if (!paused && this.path.length) {
        if (x || y) this.cancelRoute();
        else {
          const next = this.path[0];
          const distance = Math.hypot(next.x - p.x, next.y - p.y);
          if (distance < 0.14) {
            this.path.shift();
            this.lastDistance = Infinity;
            this.stuckTime = 0;
            if (!this.path.length) this.finishRoute();
          } else {
            x = (next.x - p.x) / distance;
            y = (next.y - p.y) / distance;
            const speed = Math.min(1, distance / 0.4);
            x *= speed;
            y *= speed;
            this.stuckTime = distance >= this.lastDistance - 0.005 ? this.stuckTime + delta : 0;
            this.lastDistance = distance;
            if (this.stuckTime > 700) {
              const target = this.routeTarget,
                attempt = this.routeAttempt,
                resolve = this.routeResolve;
              const retries = (this.routeRetries ?? 0) + 1;
              this.routeResolve = null;
              if (retries > 3) {
                this.cancelRoute();
                host.events.onMessage("Something is in the way. Move it, or go round.");
                resolve?.(false);
              } else {
                this.navigate(this.routeGoal, { target, attempt, resolve });
                this.routeRetries = retries;
              }
            }
          }
        }
      }
      if (x || y) {
        const length = Math.hypot(x, y);
        this.facing = { x: x / length, y: y / length };
        host.events.onMove?.();
      }
      this.phys.setIntent(x, y, run || (this.path.length > 0 && this.routeRun));
      if (!paused) this.remainder = this.phys.advance(delta / 1000, this.remainder);
      const at = this.phys.player.getPosition();
      // A trial moves the hero by hand (hops, climbs); physics takes over after.
      if (!this.heroLocked) this.hero.setPosition(at.x * TILE, at.y * TILE).setDepth(at.y * TILE + 2);
      const moving = Math.hypot(this.phys.player.getLinearVelocity().x, this.phys.player.getLinearVelocity().y) > 0.25;
      this.hero.play(this.phys.carrying ? "carry" : moving ? "walk" : "idle", time);
      if (Math.abs(this.facing.x) > 0.08) this.hero.setScale(this.facing.x < 0 ? -1 : 1, 1);
      for (const { prop, sprite } of this.propSprites) {
        const pp = prop.body.getPosition();
        sprite.setPosition(pp.x * TILE, pp.y * TILE - prop.z * 17).setDepth(pp.y * TILE + (prop.carried ? 4 : 0));
        sprite.setRotation(prop.carried ? 0 : prop.body.getAngle());
        sprite.setAlpha(prop.cracked ? 0.65 : 1);
      }
      const events = this.phys.events.splice(0);
      for (const e of events) {
        if (e.type === "crack") {
          host.events.onMessage(`The ${e.prop.kind} cracks.`);
          if (this.motion) this.cameras.main.shake(140, 0.004);
          if (e.prop.source.flag) queueMicrotask(() => !host.destroyed && host.bridge.crack(e.prop));
        }
        if (e.type === "knock" || e.type === "land") host.events.onImpact?.(e.impulse);
      }
      this.refreshPrompt();
      host.events.onFrame?.();
      // Walking off the edge of the map takes the road that leaves there.
      if (!paused && !this.dispatching) {
        const tile = this.phys.tile();
        const exit = this.places().find(
          (pl) => pl.exit && (!this.routeTarget || pl.id === this.routeTarget || pl.actions.some((a) => a.id === this.routeTarget)) && pl.tiles.some(([ex, ey]) => tile[0] === ex && tile[1] === ey),
        );
        if (exit) {
          const action = exit.actions[0];
          if (action.enabled) {
            const resolve = this.routeResolve;
            this.routeResolve = null;
            this.dispatching = true;
            this.cancelRoute();
            if (this.motion) this.cameras.main.fadeOut(260, 20, 24, 18);
            this.time.delayedCall(this.motion ? 270 : 0, () => {
              if (host.destroyed) return;
              host.bridge.request(action, exit);
              resolve?.(true);
            });
          } else if (this.blockedExit !== exit.id) {
            this.blockedExit = exit.id;
            host.events.onMessage(action.requires ?? "That way is closed for now.");
          }
        } else this.blockedExit = null;
      }
    }

    /** Screen position (CSS pixels inside the stage) of a tile centre. */
    project([x, y], lift = 0) {
      const camera = this.cameras.main;
      return {
        x: ((x + 0.5) * TILE - camera.worldView.x) * camera.zoom,
        y: ((y + 0.5) * TILE - lift - camera.worldView.y) * camera.zoom,
      };
    }
    heroScreen() {
      const camera = this.cameras.main;
      return { x: (this.hero.root.x - camera.worldView.x) * camera.zoom, y: (this.hero.root.y - 70 - camera.worldView.y) * camera.zoom };
    }

    /** Stage a trial here; resolves to an outcome or null if the player steps back. */
    trial(kind, profile, ui, seed) {
      this.cancelRoute();
      return playTrial(this, kind, profile, ui, seed);
    }

    /** Whether an action happens at a place in this scene (rather than in the story band). */
    placed(id) {
      return this.places().some((p) => p.id === id || p.actions.some((a) => a.id === id));
    }

    inspect() {
      const p = this.phys.player.getPosition();
      return {
        scene: this.snapshot.view.scene,
        position: { x: p.x, y: p.y },
        walking: this.path.length > 0,
        camera: { x: this.cameras.main.worldView.x, y: this.cameras.main.worldView.y, zoom: this.cameras.main.zoom },
        art: {
          tiles: this.textures.exists("wisdom-tiles") ? this.textures.get("wisdom-tiles").frameTotal : 0,
          kweku: this.textures.exists("puppet-kweku-head") ? 1 : 0,
        },
        places: this.places().map((pl) => pl.id),
        trial: this.trialInfo?.() ?? null,
        props: this.phys.props.map((prop) => ({ id: prop.id, x: prop.body.getPosition().x, y: prop.body.getPosition().y, cracked: prop.cracked, carried: prop.carried })),
      };
    }
  };
}
