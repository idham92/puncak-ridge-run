// The screenshot scenes behind ?shot=start|play|valley|landing. Each one plays the
// real rules forward from a fresh world for a fixed time, steered by a simple
// autopilot (bank toward the next ring or the strip, pitch toward its altitude),
// so the frame is what a short flight really looks like and the same seed always
// gives the same frame.
import { STEP, TRACK } from './config.js';
import { EVENT_CRASHED, EVENT_LANDED, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const VALLEY_SECONDS = 20;
const LANDING_LIMIT_SECONDS = 90;
const SAMPLE = 1 / 30;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Steer toward a point (targetX, targetAlt) some way ahead of the plane.
 * Throttle is returned as a delta toward targetThrottle: the world's step
 * treats the throttle control as an adjustment, not an absolute setting. */
function steerTo(state, targetX, targetAlt, targetThrottle) {
  const plane = state.plane;
  const bank = clamp((targetX - plane.x) * 0.02 - plane.heading * 0.06, -1, 1);
  const pitch = clamp((targetAlt - plane.alt) / 28, -1, 1);
  const throttle = clamp((targetThrottle - plane.throttle) * 3, -1, 1);
  return { bank, pitch, throttle };
}

/** Autopilot toward the next ring, or the strip centre when there is none. */
function ringPilot(state) {
  let target = null;
  for (const ring of state.rings) {
    if (ring.active && !ring.passed) {
      target = ring;
      break;
    }
  }
  if (target === null) return steerTo(state, 0, 100, 0.6);
  return steerTo(state, target.x, target.y + 4, 0.7);
}

/** Low autopilot for the river run: keep under the ceiling, chase the rings. */
function valleyPilot(state) {
  let target = null;
  for (const ring of state.rings) {
    if (ring.active && !ring.passed) {
      target = ring;
      break;
    }
  }
  if (target === null) return steerTo(state, 0, 40, 0.6);
  return steerTo(state, target.x, Math.min(target.y, 42), 0.65);
}

/** Landing autopilot: a steady descent onto the strip centreline. */
function landingPilot(state, world) {
  const dist = Math.max(0, TRACK.stripZ - state.z);
  const targetAlt = 18 + dist * 0.055;
  const targetX = world.centreAt(TRACK.stripZ);
  const throttle = dist > 900 ? 0.55 : dist > 300 ? 0.4 : 0.3;
  return steerTo(state, targetX, targetAlt, throttle);
}

/**
 * Set `world` to the named scene (start, play, valley or landing; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.reset(0);
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, ringPilot(state), false);
      if (events & (EVENT_CRASHED | EVENT_WIN)) break;
    }
    const over = state.status !== 'flying';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.round(state.score) };
  }
  if (name === 'valley') {
    world.reset(1);
    for (let index = 0; index < VALLEY_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, valleyPilot(state), false);
      if (events & (EVENT_CRASHED | EVENT_WIN)) break;
    }
    const over = state.status !== 'flying';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.round(state.score) };
  }
  if (name === 'landing') {
    world.reset(2);
    for (let index = 0; index < LANDING_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, landingPilot(state, world), false);
      if (events & (EVENT_CRASHED | EVENT_LANDED | EVENT_WIN)) break;
      if (state.z >= TRACK.stripZ - 420) break;
    }
    const over = state.status !== 'flying';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.round(state.score) };
  }
  world.reset(0);
  for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { bank: 0, pitch: 0, throttle: 0 }, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
