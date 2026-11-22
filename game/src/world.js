// The Marrow Museum: its walls, display cases, shadow rugs, loot, terminal and
// exit, plus the geometry the rules need (line of sight, movement against
// walls, who can see whom). No drawing and no browser in here: this is the
// floor plan and the state that starts on it.
import { FIELD, LOOT_VALUES } from './config.js';
import { randomInt } from './random.js';

/** Walls: they block movement and sight. The bottom wall leaves a doorway for the exit. */
export const WALLS = [
  { x: 0, y: 0, w: 1280, h: 24 }, // top
  { x: 0, y: 696, w: 84, h: 24 }, // bottom, west of the exit doorway
  { x: 180, y: 696, w: 1100, h: 24 }, // bottom, east of the exit doorway
  { x: 0, y: 0, w: 24, h: 720 }, // left
  { x: 1256, y: 0, w: 24, h: 720 }, // right
  { x: 24, y: 176, w: 406, h: 24 }, // top corridor, west of its door
  { x: 530, y: 176, w: 490, h: 24 }, // top corridor, east of its door
  { x: 1020, y: 24, w: 24, h: 200 }, // scarab wing divider (gap below it joins the right corridor)
  { x: 760, y: 430, w: 280, h: 24 }, // duchess wing divider, west of its door
  { x: 1140, y: 430, w: 116, h: 24 }, // duchess wing divider, east of its door
  { x: 330, y: 470, w: 24, h: 226 }, // entrance room divider
];

/** Display cases: glass boxes that block movement and sight. */
export const CASES = [
  { x: 1064, y: 78, w: 96, h: 64 }, // the Jade Scarab's case, in the scarab wing
  { x: 150, y: 300, w: 96, h: 64 }, // the Gold Bars' case, mid-left
  { x: 600, y: 280, w: 96, h: 64 }, // empty case, central gallery
  { x: 880, y: 290, w: 96, h: 64 }, // empty case, central gallery
];

/** Shadow rugs: standing on one makes you much harder to spot. */
export const RUGS = [
  { x: 500, y: 480, w: 280, h: 130 }, // central gallery rug
  { x: 1060, y: 220, w: 180, h: 120 }, // scarab wing approach rug
  { x: 48, y: 560, w: 180, h: 110 }, // entrance rug
];

/** The exit doorway mat: reach it holding the Scarab to get away clean. */
export const EXIT_ZONE = { x: 84, y: 640, w: 96, h: 56 };

/** Where Vesper slips in. */
export const SPAWN = { x: 130, y: 600 };

/** The camera terminal: hack it and the cameras go dark for a while. */
export const TERMINAL = { x: 640, y: 640, rect: { x: 600, y: 656, w: 80, h: 40 } };

/** The loot: where to stand to grab it, and what it is worth. */
export const LOOT_SPOTS = [
  { id: 'scarab', name: 'Jade Scarab', value: LOOT_VALUES.scarab, x: 1112, y: 168 },
  { id: 'gold', name: 'Gold Bars', value: LOOT_VALUES.gold, x: 198, y: 388 },
  { id: 'duchess', name: 'The Duchess', value: LOOT_VALUES.duchess, x: 948, y: 490 },
];

/** The wall cameras: where they hang, which way they face, how far they sweep. */
export const CAMERA_SPOTS = [
  { x: 640, y: 30, base: Math.PI / 2, sweep: 0.85, period: 4.2, phase: 0 },
  { x: 1250, y: 380, base: Math.PI, sweep: 0.8, period: 5.1, phase: 1.6 },
];

/** The guards: who they are, how fast they walk, and the loop they patrol. */
export const GUARD_PATROLS = [
  {
    name: 'Marlowe',
    speed: 72,
    points: [
      { x: 470, y: 360 },
      { x: 700, y: 360 },
      { x: 700, y: 560 },
      { x: 470, y: 560 },
    ],
  },
  {
    name: 'Iris',
    speed: 80,
    points: [
      { x: 300, y: 100 },
      { x: 980, y: 100 },
    ],
  },
  {
    name: 'Bram',
    speed: 70,
    points: [
      { x: 100, y: 240 },
      { x: 100, y: 560 },
      { x: 300, y: 560 },
      { x: 300, y: 240 },
    ],
  },
];

// ---------------------------------------------------------------- geometry

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Whether the segment from (x1, y1) to (x2, y2) touches a rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) return true;
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = rect.y;
  const bottom = rect.y + rect.h;
  return (
    segmentsCross(x1, y1, x2, y2, left, top, right, top) ||
    segmentsCross(x1, y1, x2, y2, right, top, right, bottom) ||
    segmentsCross(x1, y1, x2, y2, right, bottom, left, bottom) ||
    segmentsCross(x1, y1, x2, y2, left, bottom, left, top)
  );
}

/** Whether a circle overlaps a rectangle (used to keep bodies out of walls). */
export function circleHitsRect(cx, cy, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

/** Every solid rectangle: walls, cases and the terminal console. */
export function solids() {
  return [...WALLS, ...CASES, TERMINAL.rect];
}

/** Whether a circle at (x, y) overlaps anything solid. */
export function pointBlocked(x, y, radius) {
  for (const rect of solids()) {
    if (circleHitsRect(x, y, radius, rect)) return true;
  }
  return false;
}

/** Whether anything solid stands between two points. */
export function hasLineOfSight(x1, y1, x2, y2) {
  for (const rect of solids()) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return false;
  }
  return true;
}

/** Whether the point stands on a shadow rug. */
export function rugAt(x, y) {
  for (const rug of RUGS) if (pointInRect(x, y, rug)) return rug;
  return null;
}

/** The nearest rug's centre, for a thief who needs somewhere dark to wait. */
export function nearestRugCentre(x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const rug of RUGS) {
    const cx = rug.x + rug.w / 2;
    const cy = rug.y + rug.h / 2;
    const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

/**
 * Whether an observer at (ox, oy) looking along `angle` can see the point
 * (tx, ty): close enough, inside the cone, and with nothing in the way.
 */
export function canSee(ox, oy, angle, range, halfAngle, tx, ty) {
  const dx = tx - ox;
  const dy = ty - oy;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (distance < 1) return true;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > halfAngle) return false;
  return hasLineOfSight(ox, oy, tx, ty);
}

/**
 * Move a circle by (dx, dy), sliding along walls: try each axis on its own so
 * a body can slide down a wall instead of sticking to it.
 */
export function moveCircle(x, y, radius, dx, dy) {
  let nx = x + dx;
  for (const rect of solids()) {
    if (circleHitsRect(nx, y, radius, rect)) nx = x;
  }
  let ny = y + dy;
  for (const rect of solids()) {
    if (circleHitsRect(nx, ny, radius, rect)) ny = y;
  }
  nx = Math.max(24 + radius, Math.min(FIELD.width - 24 - radius, nx));
  ny = Math.max(24 + radius, Math.min(FIELD.height - 24 - radius, ny));
  return { x: nx, y: ny };
}

// ---------------------------------------------------------------- state

/** A fresh museum, dealt from the seed: guards start at a random corner of their loop. */
export function createWorld(random) {
  const guards = GUARD_PATROLS.map((patrol) => {
    const start = randomInt(random, patrol.points.length);
    const at = patrol.points[start];
    const next = patrol.points[(start + 1) % patrol.points.length];
    return {
      name: patrol.name,
      speed: patrol.speed,
      points: patrol.points,
      leg: (start + 1) % patrol.points.length,
      x: at.x,
      y: at.y,
      angle: Math.atan2(next.y - at.y, next.x - at.x),
      mode: 'patrol',
      waiting: 0,
      scan: 0,
      investigateX: 0,
      investigateY: 0,
      investigateWait: 0,
    };
  });
  const cameras = CAMERA_SPOTS.map((spot) => ({
    x: spot.x,
    y: spot.y,
    base: spot.base,
    sweep: spot.sweep,
    period: spot.period,
    phase: spot.phase,
    angle: spot.base,
    disabled: 0,
  }));
  const loot = LOOT_SPOTS.map((spot) => ({ ...spot, taken: false }));
  return {
    time: 0,
    alarm: 0,
    maxAlarm: 0,
    outcome: 'playing',
    player: { x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, sneak: false, moving: false },
    guards,
    cameras,
    loot,
    terminal: { x: TERMINAL.x, y: TERMINAL.y, hacked: 0 },
    coinsLeft: 3,
    coins: [],
    grabId: null,
    grabProgress: 0,
    hackProgress: 0,
    lootValue: 0,
    score: 0,
    rating: null,
    elapsed: 0,
  };
}
