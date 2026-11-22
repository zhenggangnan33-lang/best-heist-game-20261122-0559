// Every tuning number and colour in one place. The museum floor is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.

/** The playfield, in logical pixels. */
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The thief: a circle, quick on her feet, much slower while sneaking. */
export const PLAYER = {
  radius: 14,
  walk: 178,
  sneak: 92,
};

/** How being seen turns into alarm. */
export const DETECT = {
  guardRange: 235,
  guardHalfAngle: 0.62,
  guardRate: 52,
  cameraRange: 270,
  cameraHalfAngle: 0.5,
  cameraRate: 40,
  /** Sneaking roughly halves how fast you are noticed. */
  sneakFactor: 0.5,
  /** Standing on a shadow rug roughly halves it again. */
  rugFactor: 0.5,
  /** Alarm points lost per second while nobody can see you. */
  decay: 14,
  /** Alarm at which the guards stop patrolling and start hunting. */
  huntAt: 60,
  /** Alarm below which a hunt is called off. */
  calmAt: 45,
};

/** Guard movement and the distance at which a touch means caught. */
export const GUARD = {
  radius: 10,
  hunt: 138,
  investigate: 95,
  touch: 26,
  /** Seconds a guard waits at each patrol corner, looking around. */
  waitAtWaypoint: 0.7,
};

/** How long a hacked camera stays dark. */
export const CAMERA_OFF_SECONDS = 20;

/** Holding E near something: how close you must be, and how long it takes. */
export const INTERACT = {
  grabRadius: 54,
  grabSeconds: 0.8,
  hackRadius: 58,
  hackSeconds: 1.2,
};

/** Coins to throw: three, and how far a guard will walk to look at one. */
export const COINS = { count: 3, throwDistance: 130, hearRadius: 420 };

/** Scoring: a time bonus that fades over four minutes, plus a ghost bonus. */
export const SCORE = { timeWindow: 240, timeRate: 50, ghostBonus: 5000 };

/** What each piece of loot is worth, in dollars. */
export const LOOT_VALUES = { scarab: 50000, gold: 12000, duchess: 18000 };

export const PALETTE = {
  backdrop: '#0d0f14',
  floor: '#232733',
  floorTile: '#272c3a',
  wall: '#3a4152',
  wallTop: '#4a5266',
  rug: '#5e1f24',
  rugBorder: '#8a6d2f',
  rugPattern: '#6e2a2f',
  caseGlass: '#9fc4d8',
  caseGold: '#c9a227',
  coneGuard: '#f2d060',
  coneCamera: '#ff9a3c',
  guard: '#33415e',
  guardTrim: '#c9a227',
  camera: '#7a4a22',
  player: '#1c1a24',
  playerCloak: '#3d3757',
  playerTrim: '#7fe0c3',
  scarab: '#37c978',
  gold: '#f2c94c',
  painting: '#b98a4a',
  terminal: '#2f6f5e',
  exit: '#2f7a4d',
  alarmLow: '#37c978',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  panel: '#171a22',
  panelEdge: '#3a4152',
  text: '#eef1f5',
  muted: '#9aa3b2',
  dim: '#6b7280',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best loot total is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best-loot';
