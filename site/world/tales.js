// What each tale's world is made of: who you walk as, and who walks with you.
//
// eye: how high the hero sees from, in metres. Kweku is a boy, the Cadi a
// child, the donkey looks out from under his ears.
//
// followers: companions who join through the story. Once their flag is set
// they trail the hero from scene to scene, and their standing figure in the
// scene where they joined steps aside.
export const TALE_WORLD = {
  wisdom: { hero: "kweku", eye: 1.35, followers: [] },
  tide: { hero: "urashima", eye: 1.58, followers: [] },
  orchestra: {
    hero: "donkey",
    eye: 1.3,
    followers: [
      { kind: "dog", flag: "dog" },
      { kind: "cat", flag: "cat" },
      { kind: "rooster", flag: "rooster" },
    ],
  },
  olives: { hero: "cadi", eye: 1.12, followers: [] },
};
export const eyeOf = (tale) => TALE_WORLD[tale]?.eye ?? 1.5;
export const heroOf = (tale) => TALE_WORLD[tale]?.hero ?? "kweku";
export const followersOf = (tale, flags = {}) => (TALE_WORLD[tale]?.followers ?? []).filter((f) => flags[f.flag]);
