// Puncak Ridge Run — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

// The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

// Where the horizon sits on the 720-high field, and the camera focal length for the
// pseudo-3D projection (screen scale = FOCAL / distance-ahead).
export const HORIZON_Y = 300;
export const FOCAL = 520;

// The valley track: how long a flight is, in metres, and where the strip sits.
export const TRACK = { length: 5200, stripZ: 5000, stripHalfWidth: 26 };

export const PLANE = {
  cruiseSpeed: 82, // m/s at full throttle (~295 km/h)
  minSpeed: 34, // m/s: slower and the wings stop flying
  maxSpeed: 96,
  climbRate: 26, // m/s at full pitch up
  sinkRate: 34, // m/s at full pitch down
  turnRate: 26, // degrees per second at full bank
  bankMax: 38, // degrees of visual bank
  fuel: 100,
  fuelBurn: 0.55, // % per second at full throttle
  fuelBurnIdle: 0.16,
  ringFuel: 6, // % back per ring flown
  startAlt: 120, // metres above the valley floor
  startSpeed: 62,
};

export const MISSIONS = [
  {
    id: 'ring',
    name: 'Ring Run',
    blurb: 'Terbang melewati 8 ring emas di lembah.',
    rings: 8,
    ringAlt: 110,
    ringSpread: 90,
    lowCeiling: null,
    winText: 'Semua ring dilewati!',
  },
  {
    id: 'river',
    name: 'River Run',
    blurb: 'Terbang rendah menyusuri sungai, di bawah 70 m.',
    rings: 6,
    ringAlt: 42,
    ringSpread: 55,
    lowCeiling: 70,
    winText: 'Sungai selesai disusuri!',
  },
  {
    id: 'strip',
    name: 'Strip Landing',
    blurb: 'Capai ujung lembah dan mendarat di strip.',
    rings: 5,
    ringAlt: 95,
    ringSpread: 80,
    lowCeiling: null,
    winText: 'Mendarat sempurna!',
  },
];

export const RING = { radius: 20, points: 100, nearMissPoints: 25 };

export const PALETTE = {
  backdrop: '#0d1526',
  skyTop: '#274b7a',
  skyMid: '#7fb0d8',
  skyLow: '#f6c98a',
  sun: '#ffd97a',
  ridgeFar: '#5d7396',
  ridgeFarSnow: '#e8eef5',
  ridgeMid: '#47603f',
  ridgeNear: '#2f4a2c',
  valley: '#4d7a3d',
  fieldA: '#6da24b',
  fieldB: '#557f36',
  river: '#3f8fd2',
  riverLight: '#9fd0f2',
  ring: '#f2c94c',
  ringPassed: '#58d68d',
  strip: '#3a3f47',
  stripMark: '#f5f6f7',
  planeBody: '#e8eef5',
  planeWing: '#d84b3f',
  planeTrim: '#2b6cb0',
  panel: '#101827',
  panelEdge: '#2b3a52',
  text: '#eef1f5',
  muted: '#9fb0c3',
  warn: '#ff5d4d',
  good: '#58d68d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'puncak-ridge-run.best';
