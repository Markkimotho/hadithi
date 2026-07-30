// Browser persistence. Every read and write tolerates unavailable storage
// (private windows, blocked site data); the game stays playable and offers
// save export instead.
const KEY = "hadithi.v1";
let failed = false;
const listeners = new Set();

export function read(key, fallback) {
  try {
    const value = localStorage.getItem(`${KEY}.${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(`${KEY}.${key}`, JSON.stringify(value));
    return true;
  } catch {
    if (!failed) {
      failed = true;
      listeners.forEach((fn) => fn());
    }
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(`${KEY}.${key}`);
  } catch {
    /* Nothing to remove. */
  }
}

export const storageFailed = () => failed;
export const onStorageFailure = (fn) => listeners.add(fn);

/** Per-tale lists (endings, echoes, marks) validated against the content. */
export function perTale(key, episodes, valid) {
  const saved = read(key, {});
  return Object.fromEntries(
    episodes.map((ep) => [
      ep.id,
      Array.isArray(saved?.[ep.id]) ? [...new Set(saved[ep.id].filter((id) => valid(ep, id)))] : [],
    ]),
  );
}

export const MAX_CHRONICLE = 30;

/** Run history; one entry per finished journey, newest first. */
export function chronicle(episodes) {
  const saved = read("chronicle", {});
  return Object.fromEntries(
    episodes.map((ep) => [
      ep.id,
      Array.isArray(saved?.[ep.id])
        ? saved[ep.id].filter((r) => r && Object.hasOwn(ep.endings, r.ending)).slice(0, MAX_CHRONICLE)
        : [],
    ]),
  );
}
