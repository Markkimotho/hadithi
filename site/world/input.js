// First-person controls. Keyboard, mouse, touch and gamepad all feed one
// intent: how far forward, how far sideways, how much to turn.
//
//   W S / ↑ ↓      walk forward and back      A D       step sideways
//   ← →            turn                         mouse     look (click the view to capture it)
//   Shift          run                          E Space   act, talk, go on with the story
//   Q / F          lift or set down / throw     Esc       stop walking, free the mouse
//
// On a touch screen the stick walks and turns, a swipe anywhere else looks,
// and a tap on something walks you to it. Movement works as soon as the
// story is on screen. Leaving the window, hiding the tab or opening a dialog
// releases every key.
const MOVES = {
  w: [1, 0, 0], ArrowUp: [1, 0, 0], s: [-1, 0, 0], ArrowDown: [-1, 0, 0],
  a: [0, -1, 0], d: [0, 1, 0], ArrowLeft: [0, 0, -1], ArrowRight: [0, 0, 1],
};
export const TURN_SPEED = 2.4; // radians a second at full turn
export const LOOK_SPEED = 0.0032; // radians per pixel of mouse travel

/** Keys typed into a form field, the journal or a dialog are not for walking. */
const typing = (el) => Boolean(el?.closest?.("input, select, textarea, dialog, .journal-drawer, .play-ending"));

export function createInput(root, view, { interact, lift, toss, cancel, paused, tap, capture = true }) {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const keys = new Set();
  let stick = { x: 0, y: 0 },
    previousButtons = [],
    stickPointer = null,
    look = 0,
    drag = null;
  const active = () => root.isConnected && !paused() && !typing(document.activeElement);
  const clear = () => {
    keys.clear();
    stick = { x: 0, y: 0 };
    previousButtons = [];
    look = 0;
    drag = null;
  };
  const keyOf = (event) => (event.key.length === 1 ? event.key.toLowerCase() : event.key);
  window.addEventListener(
    "keydown",
    (event) => {
      if (!active() || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = keyOf(event);
      if (MOVES[key] || key === "Shift") {
        event.preventDefault();
        keys.add(key);
        if (MOVES[key]?.[0] || MOVES[key]?.[1]) cancel();
      } else if (!event.repeat && ["e", " ", "Enter", "q", "f", "Escape"].includes(key)) {
        // Enter and Space on a focused button keep their own meaning.
        if ((key === "Enter" || key === " ") && event.target?.closest?.("button, a")) return;
        event.preventDefault();
        if (key === "e" || key === " " || key === "Enter") interact();
        if (key === "q") lift();
        if (key === "f") toss();
        if (key === "Escape") {
          cancel();
          if (document.pointerLockElement === view) document.exitPointerLock?.();
        }
      }
    },
    options,
  );
  window.addEventListener("keyup", (e) => keys.delete(keyOf(e)), options);
  window.addEventListener("blur", clear, options);
  document.addEventListener("visibilitychange", clear, options);

  // Mouse look: captured after a click on the view, or by dragging.
  document.addEventListener(
    "mousemove",
    (e) => {
      if (document.pointerLockElement === view && active()) look += e.movementX;
    },
    options,
  );
  view.addEventListener(
    "pointerdown",
    (e) => {
      if (!active()) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, type: e.pointerType };
      view.setPointerCapture?.(e.pointerId);
    },
    options,
  );
  view.addEventListener(
    "pointermove",
    (e) => {
      if (!drag || drag.id !== e.pointerId || document.pointerLockElement === view) return;
      const dx = e.clientX - drag.x;
      drag.moved += Math.abs(dx) + Math.abs(e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (drag.moved > 6) look += dx * (drag.type === "touch" ? 1.6 : 1);
    },
    options,
  );
  view.addEventListener(
    "pointerup",
    (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const wasTap = drag.moved <= 6;
      const type = drag.type;
      drag = null;
      if (!wasTap || !active()) return;
      const r = view.getBoundingClientRect();
      // A tap on something walks you to it. A mouse click on nothing captures the mouse.
      if (tap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)) return;
      if (capture && type === "mouse" && document.pointerLockElement !== view) view.requestPointerLock?.()?.catch?.(() => {});
    },
    options,
  );
  view.addEventListener("pointercancel", () => (drag = null), options);

  const joystick = root.querySelector(".world-joystick");
  if (joystick) {
    const move = (e) => {
      if (stickPointer !== e.pointerId) return;
      const r = joystick.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / (r.width * 0.35);
      const y = (e.clientY - r.top - r.height / 2) / (r.height * 0.35);
      const length = Math.max(1, Math.hypot(x, y));
      stick = { x: x / length, y: y / length };
      joystick.style.setProperty("--stick-x", `${stick.x * 24}px`);
      joystick.style.setProperty("--stick-y", `${stick.y * 24}px`);
    };
    joystick.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        cancel();
        stickPointer = e.pointerId;
        joystick.setPointerCapture(e.pointerId);
        move(e);
      },
      options,
    );
    joystick.addEventListener("pointermove", move, options);
    const release = () => {
      stickPointer = null;
      stick = { x: 0, y: 0 };
      joystick.style.setProperty("--stick-x", "0px");
      joystick.style.setProperty("--stick-y", "0px");
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) joystick.addEventListener(type, release, options);
  }

  return {
    clear,
    /** forward and strafe in -1..1, turn in -1..1 (a rate), look in radians (already travelled). */
    read() {
      if (!active()) {
        clear();
        return { forward: 0, strafe: 0, turn: 0, look: 0, run: false, active: false };
      }
      let forward = -stick.y,
        strafe = 0,
        turn = stick.x * 0.8;
      for (const key of keys)
        if (MOVES[key]) {
          forward += MOVES[key][0];
          strafe += MOVES[key][1];
          turn += MOVES[key][2];
        }
      const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
      if (pad) {
        const dz = (n) => (Math.abs(n ?? 0) > 0.2 ? n : 0);
        forward -= dz(pad.axes[1]) + Number(pad.buttons[13]?.pressed ?? false) - Number(pad.buttons[12]?.pressed ?? false);
        strafe += dz(pad.axes[0]);
        turn += dz(pad.axes[2]) + Number(pad.buttons[15]?.pressed ?? false) - Number(pad.buttons[14]?.pressed ?? false);
        const buttons = pad.buttons.map((b) => b.pressed);
        if (buttons[0] && !previousButtons[0]) interact();
        if (buttons[2] && !previousButtons[2]) lift();
        if (buttons[3] && !previousButtons[3]) toss();
        previousButtons = buttons;
      }
      const travelled = look * LOOK_SPEED;
      look = 0;
      return {
        forward: Math.max(-1, Math.min(1, forward)),
        strafe: Math.max(-1, Math.min(1, strafe)),
        turn: Math.max(-1, Math.min(1, turn)),
        look: travelled,
        run: keys.has("Shift") || Boolean(pad?.buttons[1]?.pressed),
        active: true,
      };
    },
    destroy() {
      listeners.abort();
      clear();
      if (document.pointerLockElement === view) document.exitPointerLock?.();
    },
  };
}
