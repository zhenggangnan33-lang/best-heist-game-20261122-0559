// The Gilded Vault — every tuning number, colour and the whole level layout in
// one place. The gallery is a fixed 1280x720 logical room; the renderer scales
// it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The thief: a fast walk, a slow sneak that is much harder to spot. */
export const THIEF = {
  radius: 13,
  walkSpeed: 178,
  sneakSpeed: 96,
  /** Detection is multiplied by this while sneaking. */
  sneakVisibility: 0.55,
  /** Detection is multiplied by this while standing in a shadow zone. */
  shadowVisibility: 0.6,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 56,
  chaseSpeed: 138,
  investigateSpeed: 96,
  /** How far a guard can see, in pixels. */
  viewRange: 252,
  /** Vision cone half-angle, in radians. */
  viewHalfAngle: 0.66,
  /** Suspicion gained per second at point blank, fully exposed. */
  spotRate: 1.05,
  /** Suspicion lost per second while the thief is out of sight. */
  calmRate: 0.32,
  /** Above this suspicion a guard gives chase; below it he goes back to patrol. */
  chaseAt: 0.72,
  giveUpAt: 0.18,
};

export const CAMERA = {
  range: 300,
  halfAngle: 0.44,
  /** Alarm points per second while a live camera holds the thief in its cone. */
  alarmRate: 34,
  /** Seconds a hacked camera stays offline. */
  offlineSeconds: 20,
};

/** The shared alarm meter: 0 is silent, 100 is a lockdown and the run is over. */
export const ALARM = {
  max: 100,
  /** Alarm points lost per second while nobody can see the thief. */
  decayPerSecond: 11,
  /** Alarm at which guards stop patrolling and hunt the last seen position. */
  huntAt: 60,
};

export const LOOT = {
  /** Seconds of holding E to crack a case open. */
  channelSeconds: 0.7,
  scarabChannelSeconds: 1.3,
  /** How close the thief must stand to work on a loot case. */
  reach: 52,
};

export const COIN = {
  count: 3,
  /** Guards inside this radius of the landing spot come to look. */
  lureRadius: 430,
  /** Seconds a guard studies the coin before going back to patrol. */
  studySeconds: 3.2,
};

export const HACK = {
  reach: 56,
  channelSeconds: 2.5,
};

/** The gallery itself: walls, display cases, loot, the terminal, the exit. */
export const LEVEL = {
  wall: 24,
  exit: { x: 600, y: 672, width: 80, height: 24 },
  start: { x: 640, y: 640 },
  /** Solid rectangles the thief and the guards walk around. */
  solids: [
    // Two pillars guarding the top gallery's side doors.
    { x: 372, y: 24, width: 24, height: 176 },
    { x: 884, y: 24, width: 24, height: 176 },
    // Low walls that split the lower hall into three routes.
    { x: 24, y: 380, width: 176, height: 24 },
    { x: 1080, y: 380, width: 176, height: 24 },
    // The great display cases in the middle of the room.
    { x: 420, y: 280, width: 180, height: 92 },
    { x: 700, y: 280, width: 180, height: 92 },
    { x: 520, y: 472, width: 240, height: 80 },
    // The scarab's dais, low enough that the thief can work its front edge.
    { x: 608, y: 84, width: 64, height: 40 },
  ],
  loot: [
    { id: 'scarab', name: 'Jade Scarab', value: 50000, x: 640, y: 96, main: true },
    { id: 'gold', name: 'Gold Bars', value: 12000, x: 180, y: 300, main: false },
    { id: 'painting', name: 'The Duchess', value: 18000, x: 1152, y: 208, main: false },
  ],
  terminal: { x: 1204, y: 440 },
  /** Dark rugs: standing on one makes the thief harder to spot. */
  shadows: [
    { x: 80, y: 480, width: 220, height: 140 },
    { x: 980, y: 480, width: 220, height: 140 },
    { x: 560, y: 592, width: 160, height: 80 },
  ],
  guards: [
    {
      name: 'Marlowe',
      waypoints: [
        { x: 340, y: 240 }, { x: 940, y: 240 }, { x: 940, y: 440 }, { x: 340, y: 440 },
      ],
    },
    {
      name: 'Iris',
      waypoints: [
        { x: 300, y: 120 }, { x: 980, y: 120 }, { x: 980, y: 200 }, { x: 300, y: 200 },
      ],
    },
    {
      name: 'Bram',
      waypoints: [
        { x: 140, y: 300 }, { x: 140, y: 560 }, { x: 300, y: 560 }, { x: 300, y: 300 },
      ],
    },
  ],
  cameras: [
    { x: 56, y: 56, base: Math.PI / 2, sweep: 0.9, phase: 0 },
    { x: 1224, y: 56, base: Math.PI / 2, sweep: 0.9, phase: 2.1 },
  ],
};

export const PALETTE = {
  backdrop: '#0d0f16',
  floorLight: '#232838',
  floorDark: '#1c2130',
  floorGold: '#3a3220',
  wall: '#12141d',
  wallTrim: '#c9a227',
  caseGlass: 'rgba(150, 200, 255, 0.13)',
  caseFrame: '#8a6d2f',
  shadow: 'rgba(6, 8, 14, 0.55)',
  rug: '#1a1430',
  thief: '#e8e4d8',
  thiefTrim: '#c9a227',
  guard: '#3d5a80',
  guardTrim: '#9db4d4',
  cone: 'rgba(229, 83, 75, 0.30)',
  coneEdge: 'rgba(229, 83, 75, 0.55)',
  coneCamera: 'rgba(255, 170, 60, 0.30)',
  coneCameraEdge: 'rgba(255, 170, 60, 0.55)',
  coneOff: 'rgba(120, 130, 145, 0.10)',
  loot: '#f2c94c',
  lootGlow: 'rgba(242, 201, 76, 0.35)',
  exit: '#37c978',
  danger: '#e5534b',
  panel: 'rgba(12, 14, 22, 0.82)',
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best loot total is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best';
