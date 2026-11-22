// A small seeded generator (splitmix32): the same seed always deals the same
// museum, which is what makes the screenshot scenes repeatable. Nothing here
// reads Math.random, so a run is a pure function of its seed.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = (z ^ (z >>> 15)) >>> 0;
    return z / 4294967296;
  };
}

/** A whole number in [0, n): which patrol corner a guard starts from. */
export function randomInt(random, n) {
  return Math.floor(random() * n);
}
