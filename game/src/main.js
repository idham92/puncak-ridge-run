// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
// Three missions, picked with 1, 2 or 3 on the title screen.
//
// ?seed=N fixes the valley and the rings. ?shot=start|play|valley|landing (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASHED, EVENT_LANDED, EVENT_RING, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MISSION_1,
  ACTION_MISSION_2,
  ACTION_MISSION_3,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

// Tiny WebAudio bleeps, generated in code: a ring chime and a warning tone. No assets.
let audio = null;
function beep(freq, when, dur) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audio.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + when + dur);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(audio.currentTime + when);
    osc.stop(audio.currentTime + when + dur + 0.05);
  } catch {
    // No audio in this browser: the game plays on silently.
  }
}
function ringChime() {
  beep(880, 0, 0.18);
  beep(1318, 0.09, 0.22);
}
function warnTone() {
  beep(220, 0, 0.25);
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let mission = 0;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset(mission);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Misi ${mission + 1}. Terbang!`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    const score = Math.round(world.state.score);
    if (score > best) {
      best = score;
      saveBest(best);
    }
    announce(`${world.state.reason} Skor ${score}. Terbaik ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_MISSION_1) {
        mission = 0;
        world.reset(0);
      } else if (actions & ACTION_MISSION_2) {
        mission = 1;
        world.reset(1);
      } else if (actions & ACTION_MISSION_3) {
        mission = 2;
        world.reset(2);
      }
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Terbang.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { bank: 0, pitch: 0, throttle: 0 }, true);
      return;
    }
    const events = world.step(
      STEP,
      { bank: input.bank(), pitch: input.pitch(), throttle: input.throttle() },
      false,
    );
    if (events & EVENT_RING) {
      ringChime();
      announce(`Ring! ${world.state.ringsPassed} dari ${world.state.ringsTotal}.`);
    }
    if (events & (EVENT_CRASHED | EVENT_LANDED | EVENT_WIN)) {
      if (events & EVENT_CRASHED) warnTone();
      else ringChime();
      endGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting it fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Puncak Ridge Run. Tekan 1, 2 atau 3 untuk memilih misi, Spasi untuk terbang.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
