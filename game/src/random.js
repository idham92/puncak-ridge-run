// A small seeded random number generator (mulberry32): the same seed gives the same
// valley, the same rings and the same game, which is what makes the screenshot
// scenes repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1-D value noise from the seeded random: a smooth wobble for the valley centreline
// and the ridge silhouettes. Returns a function of distance (metres) in [-1, 1].
export function createNoise(random, wavelength, amplitude) {
  const points = [];
  const count = 64;
  for (let i = 0; i < count; i += 1) points.push(random() * 2 - 1);
  return function noise(z) {
    const t = z / wavelength;
    const i = Math.floor(t);
    const f = t - i;
    const a = points[((i % count) + count) % count];
    const b = points[(((i + 1) % count) + count) % count];
    const s = f * f * (3 - 2 * f);
    return (a + (b - a) * s) * amplitude;
  };
}
