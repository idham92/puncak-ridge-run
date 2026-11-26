// The game's rules and state, with no drawing and no browser in it: the valley, the
// plane, the rings, the strip, fuel and scoring. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react without the world
// knowing about screens or sound. Nothing here allocates after createWorld returns.
import { FIELD, FOCAL, HORIZON_Y, MISSIONS, PLANE, RING, STEP, TRACK } from './config.js';
import { createNoise } from './random.js';

export const EVENT_RING = 1;
export const EVENT_NEAR_MISS = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASHED = 8;
export const EVENT_OUT_OF_FUEL = 16;
export const EVENT_WIN = 32;

/** Half-width of the flat valley floor, in metres. */
const VALLEY_HALF = 150;
/** How far the ridges rise above the floor at their crest. */
const RIDGE_HEIGHT = 260;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createWorld(random) {
  // The valley snakes gently: the centreline wanders +-90 m over the track.
  const centre = createNoise(random, 900, 90);
  // Ridge silhouettes for the renderer: near and far layers, seeded once.
  const ridgeNear = createNoise(random, 260, 46);
  const ridgeFar = createNoise(random, 520, 90);
  const cloudSeed = [];
  for (let i = 0; i < 14; i += 1) cloudSeed.push({ x: random(), y: random(), s: 0.5 + random() });
  const trees = [];
  for (let i = 0; i < 90; i += 1) {
    const z = 200 + random() * (TRACK.length - 300);
    const side = random() < 0.5 ? -1 : 1;
    trees.push({ z, x: centre(z) + side * (40 + random() * 95), s: 0.7 + random() * 0.9 });
  }
  const fields = [];
  for (let i = 0; i < 26; i += 1) {
    const z = 250 + random() * (TRACK.length - 400);
    fields.push({ z, x: centre(z) + (random() * 2 - 1) * 110, w: 30 + random() * 70, tone: i % 2 });
  }

  const plane = {
    x: 0, alt: PLANE.startAlt, speed: PLANE.startSpeed,
    heading: 0, throttle: 0.7, fuel: PLANE.fuel, bank: 0, vspeed: 0,
  };
  const rings = [];
  for (let i = 0; i < 10; i += 1) rings.push({ x: 0, y: 0, z: 0, passed: false, active: false });
  const state = {
    plane, rings, trees, fields, cloudSeed,
    mission: 0, z: 0, score: 0, ringsPassed: 0, ringsTotal: 0,
    elapsed: 0, status: 'flying', reason: '', lowTime: 0, landed: false,
  };

  function centreAt(z) {
    return centre(z);
  }

  /** Ground height at lateral offset x and distance z: flat floor, rising ridges. */
  function terrainHeight(x, z) {
    const off = Math.abs(x - centre(z));
    if (off <= VALLEY_HALF) return 0;
    const t = Math.min(1, (off - VALLEY_HALF) / 220);
    return RIDGE_HEIGHT * t * t * (1 + 0.25 * Math.sin(z * 0.01 + x * 0.05));
  }

  function placeRings(mission) {
    const m = MISSIONS[mission];
    state.ringsTotal = m.rings;
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      if (i < m.rings) {
        ring.active = true;
        ring.passed = false;
        ring.z = 600 + (i * (TRACK.stripZ - 1000)) / Math.max(1, m.rings - 1);
        ring.x = centre(ring.z) + (i % 2 === 0 ? -1 : 1) * (10 + ((i * 37) % m.ringSpread));
        ring.y = m.ringAlt + ((i * 53) % 40) - 20;
      } else {
        ring.active = false;
        ring.passed = false;
      }
    }
  }

  function reset(mission) {
    state.mission = mission;
    state.z = 0;
    state.score = 0;
    state.ringsPassed = 0;
    state.elapsed = 0;
    state.status = 'flying';
    state.reason = '';
    state.lowTime = 0;
    state.landed = false;
    plane.x = centre(0);
    plane.alt = PLANE.startAlt;
    plane.speed = PLANE.startSpeed;
    plane.heading = 0;
    plane.throttle = 0.7;
    plane.fuel = PLANE.fuel;
    plane.bank = 0;
    plane.vspeed = 0;
    placeRings(mission);
  }

  function nextRing() {
    for (let i = 0; i < rings.length; i += 1) {
      if (rings[i].active && !rings[i].passed) return rings[i];
    }
    return null;
  }

  /**
   * One fixed step. `controls` is { bank, pitch, throttle } in -1..1.
   * With `harmless` set (the title screen's backdrop) the plane drifts but
   * nothing scores and nothing crashes.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    if (state.status !== 'flying') return events;
    state.elapsed += dt;

    // Throttle and speed.
    plane.throttle = clamp(plane.throttle + controls.throttle * dt * 0.8, 0.25, 1);
    const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    plane.speed += clamp(targetSpeed - plane.speed, -26 * dt, 18 * dt);
    if (plane.fuel <= 0) plane.speed = Math.max(PLANE.minSpeed * 0.55, plane.speed - 30 * dt);

    // Bank, heading and lateral drift.
    const bankTarget = controls.bank * PLANE.bankMax;
    plane.bank += clamp(bankTarget - plane.bank, -90 * dt, 90 * dt);
    plane.heading += (plane.bank / PLANE.bankMax) * PLANE.turnRate * dt;
    plane.heading = ((plane.heading + 180) % 360 + 360) % 360 - 180;
    plane.x += Math.sin((plane.heading * Math.PI) / 180) * plane.speed * dt;

    // Pitch and altitude.
    const vspeed = controls.pitch * (controls.pitch > 0 ? PLANE.climbRate : PLANE.sinkRate);
    plane.vspeed = vspeed;
    plane.alt += vspeed * dt;
    plane.alt = Math.max(2, Math.min(420, plane.alt));

    // Forward motion and fuel.
    state.z += plane.speed * dt;
    const burn = PLANE.fuelBurnIdle + plane.throttle * PLANE.fuelBurn;
    plane.fuel = Math.max(0, plane.fuel - burn * dt);

    // River Run: staying under the ceiling banks bonus time.
    const mission = MISSIONS[state.mission];
    if (mission.lowCeiling !== null && plane.alt <= mission.lowCeiling) {
      state.lowTime += dt;
      state.score += dt * 4;
    }

    // Rings: crossing a ring's plane near its centre scores; close counts less.
    const ring = nextRing();
    if (ring !== null && state.z >= ring.z) {
      const dx = plane.x - ring.x;
      const dy = plane.alt - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= RING.radius) {
        ring.passed = true;
        state.ringsPassed += 1;
        state.score += RING.points;
        plane.fuel = Math.min(PLANE.fuel, plane.fuel + PLANE.ringFuel);
        events |= EVENT_RING;
      } else if (dist <= RING.radius + 26) {
        ring.passed = true;
        state.ringsPassed += 1;
        state.score += RING.nearMissPoints;
        events |= EVENT_NEAR_MISS;
      } else {
        // Clean miss: the ring is gone, but it does not count toward the mission.
        ring.passed = true;
      }
      if (state.ringsPassed >= state.ringsTotal && state.mission !== 2) {
        state.status = 'won';
        state.reason = mission.winText;
        events |= EVENT_WIN;
        return events;
      }
    }

    if (harmless) return events;

    // Landing: past the strip, low, slow and lined up.
    if (state.z >= TRACK.stripZ) {
      const linedUp = Math.abs(plane.x - centre(TRACK.stripZ)) < TRACK.stripHalfWidth;
      if (plane.alt <= 26 && plane.speed <= 58 && linedUp) {
        state.status = 'landed';
        state.landed = true;
        state.score += 500 + Math.round(plane.fuel) * 2;
        state.reason = 'Mendarat sempurna di strip!';
        events |= EVENT_LANDED;
        return events;
      }
      if (state.z >= TRACK.stripZ + 260) {
        state.status = 'crashed';
        state.reason = state.mission === 2
          ? 'Melewati strip tanpa mendarat.'
          : 'Ujung lembah tercapai — ada ring yang terlewat.';
        events |= EVENT_CRASHED;
        return events;
      }
    }

    // Terrain.
    const ground = terrainHeight(plane.x, state.z);
    if (plane.alt <= ground + 2) {
      state.status = 'crashed';
      state.reason = ground > 2 ? 'Menabrak lereng gunung.' : 'Mendarat darurat di lembah.';
      events |= EVENT_CRASHED;
      return events;
    }

    // Fuel.
    if (plane.fuel <= 0 && plane.alt <= 4) {
      state.status = 'crashed';
      state.reason = 'Bahan bakar habis.';
      events |= EVENT_CRASHED | EVENT_OUT_OF_FUEL;
      return events;
    }
    if (plane.fuel <= 0) events |= EVENT_OUT_OF_FUEL;

    return events;
  }

  /** Project a world point (x, y, z) to screen space; null when behind the camera. */
  function project(x, y, z) {
    const dz = z - state.z;
    if (dz < 4) return null;
    const scale = FOCAL / dz;
    return {
      x: FIELD.width / 2 + (x - plane.x) * scale,
      y: HORIZON_Y + (plane.alt - y) * scale,
      s: scale,
    };
  }

  reset(0);
  return {
    state, reset, step, terrainHeight, centreAt, project,
    ridgeNear, ridgeFar,
    stripZ: TRACK.stripZ,
  };
}
