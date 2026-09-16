// What each tale's world is made of: who you walk as, and its terrain sheet.
export const TALE_WORLD = {
  wisdom: { hero: "kweku" },
  tide: { hero: "urashima" },
  orchestra: { hero: "donkey" },
  olives: { hero: "cadi" },
};
export const heroOf = (tale) => TALE_WORLD[tale]?.hero ?? "kweku";
