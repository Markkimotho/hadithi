import { RIGS } from "../art/rigs.js";

export { RIGS };

/** Load every rig part for one tale as textures. */
export function preloadPuppets(scene, tale = "wisdom") {
  for (const [name, rig] of Object.entries(RIGS[tale] ?? {}))
    for (const part of rig.parts) scene.load.svg(`puppet-${name}-${part.id}`, `./art/${tale}/rigs/${part.file}`, { width: rig.canvas.width, height: rig.canvas.height });
}

export const hasRig = (tale, name) => Boolean(RIGS[tale]?.[name]);

/** A layered puppet: a container per bone, an image per part, named clips. */
export function createPuppet(scene, name = "kweku", tale = "wisdom") {
  const rig = RIGS[tale]?.[name];
  if (!rig) throw new Error(`Unknown puppet rig: ${tale}/${name}`);
  const bones = new Map();
  const baseY = new Map();
  for (const bone of rig.bones) {
    const parentPivot = bone.parent ? rig.bones.find((candidate) => candidate.id === bone.parent).pivot : rig.canvas.anchor;
    const container = scene.add.container(bone.pivot[0] - parentPivot[0], bone.pivot[1] - parentPivot[1]);
    baseY.set(bone.id, bone.pivot[1] - parentPivot[1]);
    if (bone.parent) bones.get(bone.parent).add(container);
    bones.set(bone.id, container);
  }
  const root = bones.get("root");
  for (const part of [...rig.parts].sort((a, b) => a.order - b.order)) {
    const bone = rig.bones.find((candidate) => candidate.id === part.bone);
    const image = scene.add
      .image(0, 0, `puppet-${name}-${part.id}`)
      .setOrigin(part.pivot[0] / rig.canvas.width, part.pivot[1] / rig.canvas.height)
      .setPosition(part.pivot[0] - bone.pivot[0], part.pivot[1] - bone.pivot[1]);
    bones.get(part.bone).add(image);
  }
  root.setSize(rig.canvas.width, rig.canvas.height);
  root.setDepth(0);
  return {
    root,
    rig,
    bones,
    name,
    clip: "idle",
    setPosition(x, y) {
      root.setPosition(x, y);
      return this;
    },
    setDepth(depth) {
      root.setDepth(depth);
      return this;
    },
    setScale(x, y = x) {
      root.setScale(x, y);
      return this;
    },
    setAlpha(alpha) {
      root.setAlpha(alpha);
      return this;
    },
    setVisible(v) {
      root.setVisible(v);
      return this;
    },
    play(clip, elapsed = 0) {
      if (!rig.clips[clip]) clip = "idle";
      if (this.clip !== clip) {
        this.clip = clip;
        for (const bone of rig.bones) bones.get(bone.id).setRotation(0).setY(baseY.get(bone.id));
      }
      const definition = rig.clips[clip],
        t = (elapsed % definition.duration) / definition.duration;
      for (const [id, motion] of Object.entries(definition.bones)) {
        const node = bones.get(id);
        for (const [property, values] of Object.entries(motion)) {
          const at = t * (values.length - 1);
          const a = values[Math.floor(at)];
          const b = values[Math.min(values.length - 1, Math.floor(at) + 1)];
          const value = a + (b - a) * (at % 1);
          if (property === "rotation") node.setRotation(value);
          if (property === "y") node.setY(baseY.get(id) + value);
        }
      }
      return this;
    },
    destroy() {
      root.destroy(true);
    },
  };
}
