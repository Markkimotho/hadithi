// Generate layered puppet rigs (JSON + SVG parts) for the heroes and the
// people who walk with them, in the format of site/art/wisdom/rigs/kweku.json.
//
//   node scripts/generate-rigs.mjs
//
// Two body plans: a person (head, torso, two arms, two legs) and a
// four-legged animal (body, head, tail, four legs), with a two-legged bird
// variant. Commissioned art can replace any part file with the same canvas.
// Also writes site/art/rigs.js, the index the world loads rigs from.
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../site/art/", import.meta.url));
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;

// ── People ────────────────────────────────────────────────────────────────
const HUMAN_BONES = [
  { id: "root", parent: null, pivot: [32, 68] },
  { id: "torso", parent: "root", pivot: [32, 43] },
  { id: "head", parent: "torso", pivot: [32, 23] },
  { id: "leftArm", parent: "torso", pivot: [22, 39] },
  { id: "rightArm", parent: "torso", pivot: [42, 39] },
  { id: "leftLeg", parent: "root", pivot: [25, 58] },
  { id: "rightLeg", parent: "root", pivot: [39, 58] },
];
const HUMAN_CLIPS = {
  idle: { duration: 1800, bones: { torso: { y: [0, -1, 0, 1, 0] }, head: { rotation: [0, -0.025, 0, 0.02, 0] } } },
  walk: { duration: 460, bones: { leftLeg: { rotation: [-0.38, 0.38] }, rightLeg: { rotation: [0.38, -0.38] }, leftArm: { rotation: [0.25, -0.25] }, rightArm: { rotation: [-0.25, 0.25] }, torso: { y: [0, -1.5, 0, -1.5] } } },
  carry: { duration: 900, bones: { torso: { rotation: [-0.06, -0.08] }, leftArm: { rotation: [-0.62, -0.5] }, rightArm: { rotation: [-0.62, -0.5] } } },
  push: { duration: 700, bones: { torso: { rotation: [0.08, 0.12] }, leftArm: { rotation: [-0.95, -0.8] }, rightArm: { rotation: [-0.95, -0.8] } } },
  fall: { duration: 600, bones: { torso: { rotation: [0, 1.4] } } },
};

function humanParts(p) {
  const s = p.small ? 0.88 : 1;
  const W = 64,
    H = 72;
  const line = p.line ?? "#3a2c22";
  const hair = {
    short: `<path d="M20 19q3-12 12-13 10 1 13 12l-5-3-4 2-5-3-6 4z" fill="${p.hair}"/>`,
    topknot: `<path d="M21 18q2-11 11-11 9 0 11 11-11-5-22 0z" fill="${p.hair}"/><ellipse cx="32" cy="7" rx="4" ry="3.5" fill="${p.hair}"/>`,
    long: `<path d="M20 22q-1-15 12-15 13 0 12 15l-1 10q-2-9-3-14-8-3-16 0-1 5-3 14z" fill="${p.hair}"/>`,
    bald: "",
  }[p.hairStyle ?? "short"];
  const hat = {
    none: "",
    wrap: `<path d="M19 16q13-10 26 0l-1 5q-12-5-24 0z" fill="${p.hat}" stroke="${line}" stroke-width="1.5"/><path d="M22 14q10-4 20 0" stroke="#fff" stroke-opacity=".35" fill="none"/>`,
    kasa: `<path d="M12 18 32 4l20 14q-20 4-40 0z" fill="${p.hat}" stroke="${line}" stroke-width="1.5"/><path d="M32 4v14" stroke="${line}" stroke-opacity=".4"/>`,
    cap: `<path d="M21 15q11-9 22 0v4H21z" fill="${p.hat}" stroke="${line}" stroke-width="1.5"/>`,
    turban: `<path d="M19 18q0-12 13-12t13 12q-13-5-26 0z" fill="${p.hat}" stroke="${line}" stroke-width="1.5"/><path d="M22 13q10 3 20-4M21 16q11 2 22-5" stroke="${line}" stroke-opacity=".35" fill="none"/>`,
    kerchief: `<path d="M20 16q12-10 24 0l-4 4q-8-5-16 0z" fill="${p.hat}"/><path d="M42 17l6 5-6 1z" fill="${p.hat}"/>`,
    crown: `<path d="M22 13l3-7 4 5 3-7 3 7 4-5 3 7z" fill="${p.hat}" stroke="${line}" stroke-width="1"/>`,
  }[p.headwear ?? "none"];
  const garment = {
    tunic: `<path d="M22 31q10-5 20 0l5 20q-14 7-30 0z" fill="${p.cloth}" stroke="${line}" stroke-width="2"/><path d="M23 40h18l2 4H22z" fill="${p.accent}"/>`,
    kimono: `<path d="M22 31q10-5 20 0l6 22q-16 6-32 0z" fill="${p.cloth}" stroke="${line}" stroke-width="2"/><path d="M26 31l6 9 6-9" fill="none" stroke="${p.trim ?? "#f2ead8"}" stroke-width="2"/><path d="M20 42h24v5H20z" fill="${p.accent}"/>`,
    robe: `<path d="M21 31q11-5 22 0l7 28q-18 6-36 0z" fill="${p.cloth}" stroke="${line}" stroke-width="2"/><path d="M32 33v26" stroke="${p.accent}" stroke-width="3"/><path d="M22 44h20" stroke="${p.accent}" stroke-width="2" stroke-opacity=".6"/>`,
  }[p.garment ?? "tunic"];
  const pattern = p.pattern === "check" ? `<path d="M26 33v16m6-17v18m6-17v16" stroke="${p.trim ?? "#d6ae72"}" stroke-width="1.5" stroke-opacity=".7"/>` : p.pattern === "waves" ? `<path d="M23 50q3-3 6 0t6 0 6 0" fill="none" stroke="${p.trim ?? "#f2ead8"}" stroke-width="1.5"/>` : "";
  const legs = (side) => {
    const x = side < 0 ? 25 : 39;
    return p.garment === "robe"
      ? `<path d="M${x - 3} 58l-1 6 2 3h8l1-3-2-6z" fill="${p.feet ?? "#4a3a2c"}" stroke="${line}" stroke-width="1.5"/>`
      : `<path d="M${x}  50l${side < 0 ? -5 : -2} 12 2 4h9l2-3-${side < 0 ? 2 : 5}-13z" fill="${p.legs}" stroke="${line}" stroke-width="2"/><path d="M${x - 5} 63q5-2 12 0" fill="none" stroke="${p.feet ?? "#c8a778"}" stroke-width="2"/>`;
  };
  const arm = (side) =>
    side < 0
      ? `<path d="M22 35q-5 2-6 10l-2 7q3 4 6 0l5-11z" fill="${p.sleeve ?? p.cloth}" stroke="${line}" stroke-width="2"/><circle cx="16" cy="53" r="3" fill="${p.skin}"/>`
      : `<path d="M41 35q5 2 6 10l2 7q-3 4-6 0l-5-11z" fill="${p.sleeve ?? p.cloth}" stroke="${line}" stroke-width="2"/><circle cx="47" cy="53" r="3" fill="${p.skin}"/>`;
  const held = p.holds === "rod" ? `<path d="M47 52l12-40" stroke="#8a6a46" stroke-width="2"/>` : p.holds === "staff" ? `<path d="M47 52l2-44" stroke="#6a4b33" stroke-width="3"/>` : "";
  return {
    shadow: svg(W, H, `<ellipse cx="32" cy="66" rx="${15 * s}" ry="4" fill="#1e2618" opacity=".4"/>`),
    leftLeg: svg(W, H, legs(-1)),
    rightLeg: svg(W, H, legs(1)),
    torso: svg(W, H, garment + pattern),
    leftArm: svg(W, H, arm(-1)),
    rightArm: svg(W, H, arm(1) + held),
    head: svg(
      W,
      H,
      `<path d="M22 21q1-11 10-12 10 0 11 12l-3 11q-8 8-16 0z" fill="${p.skin}" stroke="${line}" stroke-width="2"/>${hair}<path d="M28 24h2m5 0h2" stroke="#221b14" stroke-width="2"/><path d="M29 30q3 2 6 0" fill="none" stroke="${line}" stroke-width="1.5"/>${p.beard ? `<path d="M24 28q8 10 16 0l-1 6q-7 6-14 0z" fill="${p.beard}"/>` : ""}${hat}`,
    ),
  };
}

// ── Animals ───────────────────────────────────────────────────────────────
function animalRig(a) {
  const W = 80,
    H = 64;
  const bones = [
    { id: "root", parent: null, pivot: [40, 60] },
    { id: "body", parent: "root", pivot: [40, 36] },
    { id: "head", parent: "body", pivot: [58, 30] },
    { id: "tail", parent: "body", pivot: [20, 32] },
    ...(a.bird
      ? [
          { id: "legNear", parent: "root", pivot: [38, 46] },
          { id: "legFar", parent: "root", pivot: [44, 46] },
        ]
      : [
          { id: "frontNear", parent: "root", pivot: [53, 44] },
          { id: "frontFar", parent: "root", pivot: [57, 44] },
          { id: "backNear", parent: "root", pivot: [26, 44] },
          { id: "backFar", parent: "root", pivot: [30, 44] },
        ]),
  ];
  const line = a.line ?? "#2f261d";
  const leg = (x, shade) =>
    a.bird
      ? `<path d="M${x} 44l-2 12m0 0-4 3m4-3 4 3" stroke="${a.legs}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
      : `<path d="M${x - 3} 42h7l-1 15h-5z" fill="${shade}" stroke="${line}" stroke-width="1.5"/><path d="M${x - 4} 56h8v3h-8z" fill="${a.hoof ?? "#2b2219"}"/>`;
  const body = a.bird
    ? `<ellipse cx="40" cy="34" rx="15" ry="12" fill="${a.coat}" stroke="${line}" stroke-width="2"/><path d="M34 32q6 6 12 0" stroke="${a.mark}" stroke-width="2" fill="none"/>`
    : `<path d="M${40 - a.len} 30q0-${a.height} ${a.len} -${a.height}h${a.len * 0.7}q${a.len * 0.4} 0 ${a.len * 0.35} ${a.height}l-2 12q-${a.len} 6-${a.len * 1.7} 0z" fill="${a.coat}" stroke="${line}" stroke-width="2"/>${a.mark ? `<path d="M${40 - a.len + 6} 34q${a.len} 6 ${a.len * 1.6} 0" stroke="${a.mark}" stroke-width="3" fill="none" stroke-opacity=".7"/>` : ""}`;
  const head = {
    donkey: `<path d="M54 30l4-8q8-4 14 4l2 8q-1 5-6 5l-10-2z" fill="${a.coat}" stroke="${line}" stroke-width="2"/><path d="M58 22l-2-14 4 1 2 13zm5-1 1-14 4 2-2 13z" fill="${a.coat}" stroke="${line}" stroke-width="1.5"/><ellipse cx="72" cy="35" rx="4" ry="3" fill="#cdbfa8"/><circle cx="64" cy="27" r="1.6" fill="#1b1611"/>`,
    dog: `<path d="M54 28q2-10 12-9 8 1 9 9l-2 5h-10l-8-1z" fill="${a.coat}" stroke="${line}" stroke-width="2"/><path d="M58 21l-4 12 4 1 3-12z" fill="${a.mark}"/><circle cx="76" cy="29" r="2.2" fill="#1b1611"/><circle cx="66" cy="25" r="1.6" fill="#1b1611"/>`,
    cat: `<path d="M54 28q1-9 9-9t9 9l-3 6h-12z" fill="${a.coat}" stroke="${line}" stroke-width="2"/><path d="M56 22l1-8 5 6zm12 0-1-8-5 6z" fill="${a.coat}" stroke="${line}" stroke-width="1.5"/><path d="M60 26h3m3 0h3" stroke="#e8d36a" stroke-width="2"/>`,
    rooster: `<circle cx="55" cy="22" r="7" fill="${a.coat}" stroke="${line}" stroke-width="2"/><path d="M51 14q2-5 4 0 2-5 4 0 2-4 3 2z" fill="#c43b2c"/><path d="M61 21l6 2-6 2z" fill="#e0a33a"/><path d="M56 28q-1 5 2 6" stroke="#c43b2c" stroke-width="3" fill="none"/><circle cx="57" cy="20" r="1.4" fill="#1b1611"/>`,
  }[a.kind];
  const tail = {
    donkey: `<path d="M22 30q-6 6-5 14l3 2" stroke="${line}" stroke-width="2.5" fill="none"/><path d="M15 44l4 6 3-5z" fill="#3a3027"/>`,
    dog: `<path d="M22 30q-8-4-10-12" stroke="${a.coat}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    cat: `<path d="M22 32q-10-2-10-14 0-6 4-6" stroke="${a.coat}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    rooster: `<path d="M27 32q-10-10-6-22 6 6 8 16m-2-6q-12-6-10-16" stroke="#2f5a4a" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M26 28q-14-2-16-12" stroke="#c46a2c" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  }[a.kind];
  const parts = {
    shadow: svg(W, H, `<ellipse cx="40" cy="58" rx="${a.bird ? 12 : 24}" ry="4" fill="#1e2618" opacity=".4"/>`),
    ...(a.bird
      ? { legFar: svg(W, H, leg(44, a.legs)), legNear: svg(W, H, leg(38, a.legs)) }
      : {
          backFar: svg(W, H, leg(30, a.shade)),
          frontFar: svg(W, H, leg(57, a.shade)),
          backNear: svg(W, H, leg(26, a.coat)),
          frontNear: svg(W, H, leg(53, a.coat)),
        }),
    tail: svg(W, H, tail),
    body: svg(W, H, body),
    head: svg(W, H, head),
  };
  const order = a.bird ? ["shadow", "legFar", "tail", "body", "legNear", "head"] : ["shadow", "backFar", "frontFar", "tail", "body", "backNear", "frontNear", "head"];
  const pivotOf = Object.fromEntries(bones.map((b) => [b.id, b.pivot]));
  const legsSwing = a.bird
    ? { legNear: { rotation: [-0.5, 0.5] }, legFar: { rotation: [0.5, -0.5] } }
    : { frontNear: { rotation: [-0.42, 0.42] }, backFar: { rotation: [-0.42, 0.42] }, frontFar: { rotation: [0.42, -0.42] }, backNear: { rotation: [0.42, -0.42] } };
  return {
    canvas: { width: W, height: H, anchor: [40, 60] },
    bones,
    parts: order.map((id, i) => ({ id, bone: id === "shadow" ? "root" : id, pivot: id === "shadow" ? [40, 58] : pivotOf[id], order: i, svg: parts[id] })),
    clips: {
      idle: { duration: 1600, bones: { body: { y: [0, -1, 0, 0.6, 0] }, tail: { rotation: [0, 0.18, 0, -0.12, 0] }, head: { rotation: [0, 0.04, 0, -0.03, 0] } } },
      walk: { duration: a.bird ? 380 : 520, bones: { ...legsSwing, body: { y: [0, -1.5, 0, -1.5] }, head: { rotation: [0.04, -0.04] }, tail: { rotation: [0.2, -0.2] } } },
      carry: { duration: 900, bones: { head: { rotation: [-0.12, -0.08] }, body: { y: [0, -1] } } },
      push: { duration: 700, bones: { body: { rotation: [0.06, 0.1] }, head: { rotation: [0.15, 0.2] } } },
      fall: { duration: 600, bones: { body: { rotation: [0, 1.2] } } },
    },
  };
}

// ── The cast ──────────────────────────────────────────────────────────────
const CAST = {
  tide: {
    urashima: { name: "Urashima", type: "human", skin: "#c99a74", hair: "#1f1c1a", hairStyle: "topknot", headwear: "kasa", hat: "#b39a62", garment: "kimono", cloth: "#46607a", accent: "#2b3a4a", trim: "#d9d2bf", legs: "#3a3f45", feet: "#d9c8a4", pattern: "waves", holds: "rod" },
    otohime: { name: "Otohime", type: "human", skin: "#e2bf9e", hair: "#191515", hairStyle: "long", headwear: "crown", hat: "#d7b25a", garment: "robe", cloth: "#b0434a", accent: "#e4c26a", sleeve: "#c8605f" },
  },
  orchestra: {
    donkey: { name: "The donkey", type: "animal", kind: "donkey", coat: "#8d8478", shade: "#6f675d", mark: "#c8bfae", len: 18, height: 12 },
    dog: { name: "The dog", type: "animal", kind: "dog", coat: "#9a6a3e", shade: "#7a5230", mark: "#5a3c22", len: 14, height: 9 },
    cat: { name: "The cat", type: "animal", kind: "cat", coat: "#5c5a57", shade: "#46443f", mark: "#8a8781", len: 11, height: 8 },
    rooster: { name: "The rooster", type: "animal", kind: "rooster", bird: true, coat: "#d9b07a", mark: "#a8783e", legs: "#d9a03a" },
  },
  olives: {
    cadi: { name: "The courtyard cadi", type: "human", small: true, skin: "#b8835a", hair: "#1c1612", hairStyle: "short", headwear: "turban", hat: "#e9dcc0", garment: "robe", cloth: "#2f5f73", accent: "#d7b25a", feet: "#7a4e2c" },
    alicogia: { name: "Ali Cogia", type: "human", skin: "#a8774f", hair: "#2a2420", headwear: "turban", hat: "#c9a14a", garment: "robe", cloth: "#7a4e3a", accent: "#c9a14a", beard: "#3a3029", holds: "staff" },
  },
};

const index = {};
for (const [tale, people] of Object.entries(CAST)) {
  const dir = new URL(`${tale}/rigs/`, `file://${root}`);
  await mkdir(new URL("parts/", dir), { recursive: true });
  for (const [id, spec] of Object.entries(people)) {
    let rig;
    if (spec.type === "human") {
      const svgs = humanParts(spec);
      const order = ["shadow", "leftLeg", "rightLeg", "torso", "leftArm", "rightArm", "head"];
      const pivot = Object.fromEntries(HUMAN_BONES.map((b) => [b.id, b.pivot]));
      rig = {
        canvas: { width: 64, height: 72, anchor: [32, 68] },
        bones: HUMAN_BONES,
        parts: order.map((p, i) => ({ id: p, bone: p === "shadow" ? "root" : p, pivot: p === "shadow" ? [32, 66] : pivot[p], order: i, svg: svgs[p] })),
        clips: HUMAN_CLIPS,
      };
    } else rig = animalRig(spec);
    const parts = [];
    for (const part of rig.parts) {
      const file = `parts/${id}-${part.id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}.svg`;
      await writeFile(new URL(file, dir), part.svg);
      parts.push({ id: part.id, file, bone: part.bone, pivot: part.pivot, order: part.order });
    }
    const json = { version: 1, name: spec.name, canvas: rig.canvas, bones: rig.bones, parts, clips: rig.clips };
    await writeFile(new URL(`${id}.json`, dir), `${JSON.stringify(json, null, 2)}\n`);
    (index[tale] ??= []).push(id);
  }
}

// The index: every rig on disk, including hand-made ones (Wisdom's).
const all = {};
for (const tale of await readdir(root, { withFileTypes: true })) {
  if (!tale.isDirectory()) continue;
  try {
    const files = await readdir(new URL(`${tale.name}/rigs/`, `file://${root}`));
    all[tale.name] = files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
  } catch {
    /* a tale without rigs */
  }
}
const lines = ["// Generated by scripts/generate-rigs.mjs. Every puppet rig the world can load, by tale.", ""];
for (const [tale, ids] of Object.entries(all))
  for (const id of ids) lines.push(`import ${tale}_${id} from "./${tale}/rigs/${id}.json" with { type: "json" };`);
lines.push("", "export const RIGS = {");
for (const [tale, ids] of Object.entries(all)) lines.push(`  ${tale}: { ${ids.map((id) => `${id}: ${tale}_${id}`).join(", ")} },`);
lines.push("};", "");
await writeFile(new URL("rigs.js", `file://${root}`), lines.join("\n"));
console.log(`Rigs: ${Object.entries(all).map(([t, ids]) => `${t} (${ids.join(", ")})`).join("; ")}`);
