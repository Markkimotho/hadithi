import kweku from "../art/wisdom/rigs/kweku.json" with { type: "json" };
import anansi from "../art/wisdom/rigs/anansi.json" with { type: "json" };

export const RIGS = { kweku, anansi };

export function preloadPuppets(scene) {
  for (const [name, rig] of Object.entries(RIGS)) {
    for (const part of rig.parts) {
      const key = `puppet-${name}-${part.id}`;
      scene.load.svg(key, `./art/wisdom/rigs/${part.file}`, { width: rig.canvas.width, height: rig.canvas.height });
    }
  }
}

export function createPuppet(scene, name = "kweku") {
  const rig = RIGS[name];
  if (!rig) throw new Error(`Unknown puppet rig: ${name}`);
  const bones = new Map();
  for (const bone of rig.bones) {
    const parentPivot = bone.parent ? rig.bones.find((candidate) => candidate.id === bone.parent).pivot : rig.canvas.anchor;
    const container = scene.add.container(bone.pivot[0] - parentPivot[0], bone.pivot[1] - parentPivot[1]);
    if (bone.parent) bones.get(bone.parent).add(container);
    bones.set(bone.id, container);
  }
  const root = bones.get("root");
  for (const part of [...rig.parts].sort((a, b) => a.order - b.order)) {
    const bone = rig.bones.find((candidate) => candidate.id === part.bone);
    const image = scene.add.image(0, 0, `puppet-${name}-${part.id}`)
      .setOrigin(part.pivot[0] / rig.canvas.width, part.pivot[1] / rig.canvas.height)
      .setPosition(part.pivot[0] - bone.pivot[0], part.pivot[1] - bone.pivot[1]);
    bones.get(part.bone).add(image);
  }
  root.setSize(rig.canvas.width, rig.canvas.height);
  root.setDepth(0);
  return {
    root, rig, bones, name, clip: "idle",
    setPosition(x, y) { root.setPosition(x, y); return this; },
    setDepth(depth) { root.setDepth(depth); return this; },
    setScale(x, y = x) { root.setScale(x, y); return this; },
    setAlpha(alpha) { root.setAlpha(alpha); return this; },
    play(clip, elapsed = 0) {
      if (!rig.clips[clip]) clip = "idle";
      if (this.clip !== clip) {
        this.clip = clip;
        for (const bone of rig.bones) {
          const node = bones.get(bone.id);
          node.setRotation(0);
          node.setY(bone.pivot[1] - (bone.parent ? rig.bones.find((b) => b.id === bone.parent).pivot[1] : rig.canvas.anchor[1]));
        }
      }
      const definition = rig.clips[clip], t = (elapsed % definition.duration) / definition.duration;
      for (const [id, motion] of Object.entries(definition.bones)) {
        const node = bones.get(id);
        for (const [property, values] of Object.entries(motion)) {
          const a = values[Math.floor(t * (values.length - 1))];
          const b = values[Math.min(values.length - 1, Math.floor(t * (values.length - 1)) + 1)];
          const amount = t * (values.length - 1) % 1;
          const value = a + (b - a) * amount;
          if (property === "rotation") node.setRotation(value);
          if (property === "y") {
            const bone = rig.bones.find((item) => item.id === id);
            const baseline = bone.pivot[1] - (bone.parent ? rig.bones.find((item) => item.id === bone.parent).pivot[1] : rig.canvas.anchor[1]);
            node.setY(baseline + value);
          }
        }
      }
      return this;
    },
    destroy() { root.destroy(true); },
  };
}
