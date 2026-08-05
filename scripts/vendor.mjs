// Third-party files served next to the site. They are installed by npm and
// never committed: the dev server maps these paths into node_modules and the
// build copies them into dist, where the service worker precaches them.
import { fileURLToPath } from "node:url";

const modules = fileURLToPath(new URL("../node_modules/", import.meta.url));
const font = (pkg, file) => [`fonts/${file}`, `@fontsource-variable/${pkg}/files/${file}`];
const faces = (pkg) =>
  ["latin", "latin-ext"].flatMap((subset) =>
    ["normal", "italic"].map((style) => font(pkg, `${pkg}-${subset}-wght-${style}.woff2`)),
  );

/** Published path → path inside node_modules. */
export const VENDOR = Object.fromEntries([
  ["vendor/phaser.esm.min.js", "phaser/dist/phaser.esm.min.js"],
  ["vendor/planck.mjs", "planck/dist/planck.mjs"],
  ...faces("literata"),
  ...faces("fraunces"),
  ...faces("atkinson-hyperlegible-next"),
]);

export const vendorSource = (published) =>
  VENDOR[published] ? modules + VENDOR[published] : null;
