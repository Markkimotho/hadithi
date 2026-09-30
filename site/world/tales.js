// What each tale's world is made of: who you walk as, and who walks with you.
//
// followers: companions who join through the story. Once their flag is set
// they trail the hero from scene to scene, and their standing figure in the
// scene where they joined steps aside.
export const TALE_WORLD = {
  wisdom: { hero: "kweku", followers: [] },
  tide: { hero: "urashima", followers: [] },
  orchestra: {
    hero: "donkey",
    followers: [
      { kind: "dog", flag: "dog" },
      { kind: "cat", flag: "cat" },
      { kind: "rooster", flag: "rooster" },
    ],
  },
  olives: { hero: "cadi", followers: [] },
};
export const heroOf = (tale) => TALE_WORLD[tale]?.hero ?? "kweku";
export const followersOf = (tale, flags = {}) => (TALE_WORLD[tale]?.followers ?? []).filter((f) => flags[f.flag]);
