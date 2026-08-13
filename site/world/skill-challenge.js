const TITLES = { leap: "Cross the stepping stones", balance: "Keep your footing", scale: "Set the arguments on the scale", brace: "Read the gusts" };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Turn the story check's established odds into visible, deterministic challenge tolerances. */
export function challengeParameters(kind, profile = {}) {
  const chance = clamp(Number(profile.chance ?? 0.5), 0, 1);
  const assist = profile.assist ? 1 : 0;
  return {
    threshold: clamp(0.94 - chance * 0.34 - assist * 0.08, 0.54, 0.92),
    timingWindow: clamp((kind === "leap" ? 12 : 8) + chance * (kind === "leap" ? 10 : 6) + assist * 8, 8, 32),
    timingSpeed: clamp(2.9 - chance * 0.8 - assist * 0.35, 1.4, 2.9),
    sway: clamp(1 - chance * 0.45 - assist * 0.25, 0.25, 1),
  };
}

/** Small, accessible world-mode challenges. The engine receives only the settled outcome. */
export function runSkillChallenge(host, kind, profile = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("section");
    dialog.className = "world-skill";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "skill-title");
    dialog.tabIndex = -1;
    dialog.innerHTML = `<h2 id="skill-title">${TITLES[kind] ?? "Try the challenge"}</h2><p class="skill-instructions"></p><div class="skill-play"></div><p class="skill-status" role="status" aria-live="polite"></p><button class="skill-cancel" type="button">Leave the challenge</button>`;
    host.root.append(dialog);
    host.skillActive = true;
    const instructions = dialog.querySelector(".skill-instructions");
    const play = dialog.querySelector(".skill-play");
    const status = dialog.querySelector(".skill-status");
    let closed = false, timer;
    const finish = (score) => {
      if (closed) return;
      closed = true; clearInterval(timer); host.skillActive = false; dialog.remove();
      if (score == null) resolve(null);
      else {
        score = clamp(score, 0, 1);
        const params = challengeParameters(kind, profile);
        resolve({ mode: "skill", pass: score >= params.threshold, score: Number(score.toFixed(3)) });
      }
    };
    dialog.querySelector(".skill-cancel").addEventListener("click", () => finish(null));
    const button = (label, action) => {
      const el = document.createElement("button"); el.type = "button"; el.className = "button"; el.textContent = label; el.addEventListener("click", action); play.append(el); return el;
    };
    const timing = kind === "leap" || kind === "brace";
    if (timing) {
      const total = kind === "leap" ? 3 : 4, scores = [];
      let phase = 0, currentRound = 1;
      instructions.textContent = kind === "leap"
        ? "The current keeps shifting the stones. Jump when the marker reaches the pale landing zone."
        : "Watch the gust move across the path. Brace when it reaches the sheltered mark.";
      play.innerHTML = `<div class="skill-track" data-kind="${kind}" aria-hidden="true"><span class="skill-stone stone-one"></span><span class="skill-stone stone-two"></span><span class="skill-stone stone-three"></span><span class="skill-zone"></span><span class="skill-marker"></span></div><p class="skill-round"></p>`;
      const marker = play.querySelector(".skill-marker"), round = play.querySelector(".skill-round");
      const params = challengeParameters(kind, profile);
      const safeWidth = params.timingWindow;
      const targets = kind === "leap" ? [50, 61, 42] : [48, 58, 45, 55];
      const pressure = clamp((profile.stats?.danger ?? 0) / 10, 0, 1);
      let target = targets[0] - pressure * 4;
      const zone = play.querySelector(".skill-zone");
      zone.style.left = `${target - safeWidth / 2}%`; zone.style.width = `${safeWidth}%`;
      const press = button(kind === "leap" ? "Jump · Space" : "Brace · Space", () => {
        const rawDistance = Math.abs(phase - target);
        const distance = Math.min(rawDistance, 100 - rawDistance);
        scores.push(clamp(1 - distance / (safeWidth * 1.9), 0, 1));
        if (scores.length === total) {
          const score = scores.reduce((sum, n) => sum + n, 0) / total;
          status.textContent = kind === "leap"
            ? (score > 0.8 ? "All three stones hold." : "You make the far bank, soaked by the current.")
            : (score > 0.8 ? "You keep the pot under cover." : "You find shelter after a hard shove from the gust.");
          setTimeout(() => finish(score), 450);
        } else {
          currentRound++;
          target = targets[currentRound - 1] + (kind === "leap" ? -pressure * 4 : pressure * 6);
          zone.style.left = `${target - safeWidth / 2}%`;
          round.textContent = kind === "leap" ? `Stone ${currentRound} of ${total}` : `Gust ${currentRound} of ${total}`;
          if (kind === "leap") play.querySelector(".stone-two").style.transform = `translateY(${currentRound === 2 ? 7 : 0}px)`;
        }
      });
      round.textContent = kind === "leap" ? `Stone 1 of ${total}` : `Gust 1 of ${total}`;
      const advance = () => {
        phase = (phase + params.timingSpeed * (1 + pressure * 0.35)) % 100;
        marker.style.left = `${phase}%`;
        if (kind === "leap") {
          const bob = Math.sin(phase / 10) * 3;
          play.querySelectorAll(".skill-stone").forEach((stone, index) => { if (index !== 1 || currentRound !== 2) stone.style.transform = `translateY(${Math.sin(phase / 9 + index) * 3}px)`; });
          play.querySelector(".stone-two").style.opacity = String(0.65 + Math.abs(bob) / 10);
        }
      };
      if (host.motion) timer = setInterval(advance, 30);
      else { instructions.textContent += " Use Advance marker to move it without animation."; button("Advance marker", advance); }
      dialog.addEventListener("keydown", (event) => {
        if ((event.code === "Space" || event.code === "Enter") && event.target === dialog) { event.preventDefault(); press.click(); }
      });
    } else if (kind === "balance") {
      const behind = profile.flags?.includes("behind") || profile.flags?.includes("knotTaught");
      instructions.textContent = behind
        ? "The pot rides against your back. Shift with the branch as its weight settles behind you."
        : "The pot pulls from in front. Lean back against its weight, then follow the branch as it sways.";
      play.innerHTML = `<label for="balance-control">Shift your weight</label><div class="balance-track" aria-hidden="true"><span class="balance-sweetspot"></span><span class="balance-load"></span></div><input id="balance-control" type="range" min="0" max="100" value="50"><p class="balance-readout">Weight: forward</p><progress max="100" value="0"></progress>`;
      const range = play.querySelector("input"), readout = play.querySelector(".balance-readout"), progress = play.querySelector("progress"), load = play.querySelector(".balance-load"), sweetspot = play.querySelector(".balance-sweetspot");
      const params = challengeParameters(kind, profile);
      const loadOffset = behind ? 0 : 12;
      sweetspot.style.left = `${42 + loadOffset}%`;
      let samples = 0, total = 0, elapsed = 0;
      range.addEventListener("input", () => { readout.textContent = `Weight: ${range.value < 40 ? "back" : range.value > 60 ? "forward" : "centred"}`; load.style.left = `${range.value}%`; });
      status.textContent = behind ? "The knot steadies the jar. Hold your balance for five seconds." : "The front-loaded pot needs a counter-lean. Hold your balance for five seconds.";
      timer = setInterval(() => {
        elapsed += 50;
        const sway = host.motion ? params.sway : 0;
        const target = 50 + loadOffset + (Math.sin(elapsed / 550) * 14 + Math.sin(elapsed / 1300) * 8) * sway;
        sweetspot.style.left = `${target - 8}%`;
        const error = Math.abs(Number(range.value) - target);
        total += clamp(1 - error / (38 + (1 - params.sway) * 12), 0, 1); samples++;
        progress.value = Math.min(100, elapsed / 50);
        if (elapsed >= 5000) {
          const score = total / samples;
          status.textContent = score > 0.72 ? "You find the tree’s rhythm." : "The branch dips, but you cling on.";
          setTimeout(() => finish(score), 450);
        }
      }, 50);
    } else if (kind === "scale") {
      instructions.textContent = "Choose what you know, then place it on the elders’ scale before their patience runs out.";
      play.innerHTML = `<p>Choose what to put before the circle</p><div class="scale-stones"></div><p class="scale-total" aria-live="polite">Weight: 0 · Balance: 4</p><progress class="scale-patience" max="100" value="100" aria-label="The elders’ patience"></progress>`;
      const knownClues = new Set(profile.clues ?? []), deductions = new Set(profile.deductions ?? []), flags = new Set(profile.flags ?? []);
      const evidence = [
        { id: "listen", label: "Hear him before judging", weight: 2, available: true },
        { id: "ask", label: "Let him say what he wants", weight: 2, available: true },
        { id: "selfSealed", label: "The new seal was his promise", weight: 3, available: knownClues.has("promiseSeal") || deductions.has("selfSealed") },
        { id: "whyHide", label: "He hoped someone would follow", weight: 2, available: deductions.has("whyHide") },
        { id: "savedWhisper", label: "The gourd kept one voice", weight: 1, available: flags.has("savedWhisper") },
        { id: "knotTaught", label: "He let another carry the weight", weight: 1, available: flags.has("knotTaught") },
        { id: "gathered", label: "The neighbours came to listen", weight: 1, available: flags.has("gathered") },
      ].filter((stone) => stone.available);
      const chosen = new Set(), stones = play.querySelector(".scale-stones"), total = play.querySelector(".scale-total"), patience = play.querySelector(".scale-patience");
      const duration = Math.max(8000, Number(profile.skill?.patience ?? 4) * 3500);
      let elapsed = 0, submitted = false;
      const sumWeight = () => evidence.filter((stone) => chosen.has(stone.id)).reduce((sum, stone) => sum + stone.weight, 0);
      const settle = (expired = false) => {
        if (submitted) return;
        submitted = true;
        const sum = sumWeight(), score = clamp(1 - Math.abs(4 - sum) / 4, 0, 1);
        status.textContent = expired
          ? "The elders have waited long enough."
          : sum === 4 ? "The scale settles. The circle gives him room to speak." : "The scale tips. You have not yet given the circle enough to weigh.";
        setTimeout(() => finish(score), 450);
      };
      evidence.forEach((stoneData) => {
        const stone = button(`${stoneData.label} · ${stoneData.weight}`, () => {
          if (chosen.has(stoneData.id)) chosen.delete(stoneData.id); else chosen.add(stoneData.id);
          stone.setAttribute("aria-pressed", String(chosen.has(stoneData.id)));
          const sum = sumWeight(); total.textContent = `Weight: ${sum} · Balance: 4`;
        });
        stone.setAttribute("aria-pressed", "false"); stones.append(stone);
      });
      button("Set the scale", settle);
      timer = setInterval(() => {
        elapsed += 100; patience.value = Math.max(0, 100 * (1 - elapsed / duration));
        if (elapsed >= duration) settle(true);
      }, 100);
    } else finish(null);
    dialog.focus();
  });
}
