const MOVES = {
  ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
};

// All input sources feed the same intent. Focus and visibility stop movement;
// typing in the journal or opening a dialog cannot leave a key held down.
export function createInput(root, viewport, { interact, lift, toss, cancel, paused }) {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const keys = new Set();
  let stick = { x: 0, y: 0 }, previousButtons = [], pointer = null;
  const active = () => root.contains(document.activeElement) && !paused();
  const clear = () => { keys.clear(); stick = { x: 0, y: 0 }; previousButtons = []; };
  const focus = () => viewport.focus({ preventScroll: true });
  root.addEventListener("keydown", (event) => {
    if (!active() || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (MOVES[key] || key === "Shift") {
      event.preventDefault();
      event.stopPropagation();
      keys.add(key);
      cancel();
    } else if (!event.repeat && ["e", "q", "f", "Escape"].includes(key)) {
      event.preventDefault();
      event.stopPropagation();
      if (key === "e") interact();
      if (key === "q") lift();
      if (key === "f") toss();
      if (key === "Escape") cancel();
    }
  }, options);
  window.addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key), options);
  window.addEventListener("blur", clear, options);
  root.addEventListener("focusout", clear, options);
  document.addEventListener("visibilitychange", clear, options);
  const joystick = root.querySelector(".world-joystick");
  function move(e) {
    if (pointer !== e.pointerId) return;
    const r = joystick.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width * 0.35);
    let y = (e.clientY - r.top - r.height / 2) / (r.height * 0.35);
    const length = Math.max(1, Math.hypot(x, y));
    stick = { x: x / length, y: y / length };
    joystick.style.setProperty("--stick-x", `${stick.x * 24}px`);
    joystick.style.setProperty("--stick-y", `${stick.y * 24}px`);
  }
  joystick.addEventListener("pointerdown", (e) => {
    e.preventDefault(); focus(); cancel(); pointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId); move(e);
  }, options);
  joystick.addEventListener("pointermove", move, options);
  const release = () => {
    pointer = null; stick = { x: 0, y: 0 };
    joystick.style.setProperty("--stick-x", "0px"); joystick.style.setProperty("--stick-y", "0px");
  };
  joystick.addEventListener("pointerup", release, options);
  joystick.addEventListener("pointercancel", release, options);
  joystick.addEventListener("lostpointercapture", release, options);
  return {
    clear,
    read() {
      if (!active()) { clear(); return { x: 0, y: 0, run: false, active: false }; }
      let x = stick.x, y = stick.y;
      for (const key of keys) if (MOVES[key]) { x += MOVES[key][0]; y += MOVES[key][1]; }
      const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
      if (pad) {
        const deadzone = (n) => Math.abs(n ?? 0) > 0.2 ? n : 0;
        x += deadzone(pad.axes[0]) + Number(pad.buttons[15]?.pressed ?? false) - Number(pad.buttons[14]?.pressed ?? false);
        y += deadzone(pad.axes[1]) + Number(pad.buttons[13]?.pressed ?? false) - Number(pad.buttons[12]?.pressed ?? false);
        const buttons = pad.buttons.map((b) => b.pressed);
        if (buttons[0] && !previousButtons[0]) interact();
        if (buttons[2] && !previousButtons[2]) lift();
        if (buttons[3] && !previousButtons[3]) toss();
        previousButtons = buttons;
      }
      return { x, y, run: keys.has("Shift") || Boolean(pad?.buttons[1]?.pressed), active: true };
    },
    destroy() { listeners.abort(); clear(); },
  };
}
